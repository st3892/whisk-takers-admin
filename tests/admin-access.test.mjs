import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the real authorization helper with a fake Supabase boundary.
const source = readFileSync(new URL("../lib/auth/access.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const context = { exports: {}, console: { error() {}, warn() {} } };
vm.runInNewContext(compiled, context);
const { getAdminAccess } = context.exports;

function client({ user = { id: "verified-user" }, authError = null, profile = null, error = null } = {}) {
  const calls = [];
  const query = {
    select(value) { calls.push(["select", value]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    async maybeSingle() { return { data: profile, error }; },
  };
  return {
    calls,
    auth: { async getUser() { return { data: { user }, error: authError }; } },
    schema(value) { calls.push(["schema", value]); return this; },
    from(value) { calls.push(["from", value]); return query; },
  };
}

for (const [name, options, expected] of [
  ["logged out", { user: null }, "logged-out"],
  ["invalid identity", { authError: new Error("invalid") }, "logged-out"],
  ["normal user", { profile: { is_superadmin: false } }, "unauthorized"],
  ["missing profile", {}, "unauthorized"],
  ["missing flag", { profile: {} }, "unauthorized"],
  ["null flag", { profile: { is_superadmin: null } }, "unauthorized"],
  ["truthy string is insufficient", { profile: { is_superadmin: "true" } }, "unauthorized"],
  ["RLS or database error fails closed", { profile: { is_superadmin: true }, error: new Error("denied") }, "unavailable"],
  ["superadmin", { profile: { is_superadmin: true } }, "authorized"],
]) {
  test(name, async () => {
    const supabase = client(options);
    const result = await getAdminAccess(supabase);
    assert.equal(result.status, expected);
    if (expected === "logged-out") assert.equal(supabase.calls.length, 0);
    else assert.deepEqual(supabase.calls, [
      ["schema", "public"], ["from", "profiles"], ["select", "is_superadmin"], ["eq", "id", "verified-user"],
    ]);
  });
}

test("account switches always query the current verified identity and fresh flag", async () => {
  const supabase = client({ profile: { is_superadmin: true } });
  for (const id of ["first-admin", "c7325ff0-7c7e-48cf-91b5-87ce405b7ee2", "third-admin"]) {
    supabase.auth.getUser = async () => ({ data: { user: { id } }, error: null });
    assert.equal((await getAdminAccess(supabase)).status, "authorized");
    assert.deepEqual(supabase.calls.at(-1), ["eq", "id", id]);
  }
  supabase.from = () => ({
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: { is_superadmin: false }, error: null }; },
  });
  assert.equal((await getAdminAccess(supabase)).status, "unauthorized");
});

test("authorization waits for the current user's profile lookup", async () => {
  const supabase = client();
  let resolveProfile;
  const profile = new Promise(resolve => { resolveProfile = resolve; });
  supabase.from = () => ({
    select() { return this; },
    eq() { return this; },
    maybeSingle() { return profile; },
  });
  let completed = false;
  const pending = getAdminAccess(supabase).then(result => { completed = true; return result; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  resolveProfile({ data: { is_superadmin: true }, error: null });
  assert.equal((await pending).status, "authorized");
});
