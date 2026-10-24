import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const context = { exports: {}, FormData, Date, BigInt, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context.exports;
}
const input = load("../lib/admin/generation-input.ts");
const data = load("../lib/admin/data.ts", { "server-only": {} });
function form(values) { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; }
function setup({ denied = false, error = null, rows = [{ id: 42 }] } = {}) {
  const calls = [];
  const query = {
    insert(values) { calls.push(["insert", values]); return this; },
    update(values) { calls.push(["update", values]); return this; },
    delete() { calls.push(["delete"]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    select() { return this; },
    single() { return Promise.resolve({ data: rows[0], error }); },
    then(resolve, reject) { return Promise.resolve({ data: rows, error }).then(resolve, reject); },
  };
  const actions = load("../app/admin/generations/actions.ts", {
    "next/cache": { revalidatePath(path) { calls.push(["revalidate", path]); } },
    "@/lib/auth/require-admin": { async requireAdmin() {
      calls.push(["authorize"]);
      if (denied) throw new Error("Unauthorized");
      return { user: { id: "admin-id" }, supabase: { from(table) { calls.push(["from", table]); return query; } } };
    } },
    "@/lib/admin/data": data,
    "@/lib/admin/generation-input": input,
  });
  return { actions, calls };
}
const valid = { prompt: "  Make a joke  ", generated_text: "  A bakery joke.  " };
test("every mutation checks admin before touching the database", async () => {
  for (const name of ["createGeneration", "updateGeneration", "deleteGeneration"]) {
    const { actions, calls } = setup({ denied: true });
    await assert.rejects(actions[name]({}, form({ ...valid, id: "42", confirmation: "42" })), /Unauthorized/);
    assert.deepEqual(calls, [["authorize"]]);
  }
});
test("create uses admin ownership, timestamp and an allowlist of fields", async () => {
  const { actions, calls } = setup();
  const result = await actions.createGeneration({}, form({ ...valid, user_id: "attacker", is_superadmin: "true" }));
  assert.ok(result.success);
  const values = calls.find(call => call[0] === "insert")[1];
  assert.equal(values.user_id, "admin-id");
  assert.equal(values.prompt, "Make a joke");
  assert.ok(Date.parse(values.created_at));
  assert.equal("is_superadmin" in values, false);
  assert.equal("id" in values, false);
});
test("update modifies only prompt and generated_text", async () => {
  const { actions, calls } = setup();
  assert.ok((await actions.updateGeneration({}, form({ ...valid, id: "42", user_id: "attacker" }))).success);
  assert.deepEqual(Object.keys(calls.find(call => call[0] === "update")[1]).sort(), ["generated_text", "prompt"]);
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "id" && call[2] === "42"));
});
test("invalid inputs and missing deletion confirmation cannot mutate", async () => {
  for (const [name, values] of [["createGeneration", { prompt: "", generated_text: "x" }], ["updateGeneration", { ...valid, id: "42 OR 1=1" }], ["deleteGeneration", { id: "42", confirmation: "41" }]]) {
    const { actions, calls } = setup();
    assert.ok((await actions[name]({}, form(values))).error);
    assert.deepEqual(calls, [["authorize"]]);
  }
});
test("delete only deletes the generation and requires exact confirmation", async () => {
  const { actions, calls } = setup();
  assert.ok((await actions.deleteGeneration({}, form({ id: "42", confirmation: "42" }))).success);
  assert.deepEqual(calls.filter(call => call[0] === "from"), [["from", "generations"]]);
});
test("RLS errors stop mutations without revalidation or bypass", async () => {
  const { actions, calls } = setup({ error: { code: "42501", message: "policy denied" } });
  assert.match((await actions.createGeneration({}, form(valid))).error, /RLS/);
  assert.equal(calls.some(call => call[0] === "revalidate"), false);
});
test("zero-row update/delete cannot report success", async () => {
  for (const name of ["updateGeneration", "deleteGeneration"]) {
    const { actions } = setup({ rows: [] });
    assert.match((await actions[name]({}, form({ ...valid, id: "42", confirmation: "42" }))).error, /No row/);
  }
});
test("foreign-key delete failures are surfaced", async () => {
  const { actions } = setup({ error: { code: "23503", message: "referenced" } });
  assert.match((await actions.deleteGeneration({}, form({ id: "42", confirmation: "42" }))).error, /foreign-key/);
});
test("bigint bounds are validated without losing precision", () => {
  assert.equal(input.generationId("9223372036854775807"), "9223372036854775807");
  assert.equal(input.generationId("9223372036854775808"), null);
  assert.equal(input.generationId("-1"), null);
});
test("actual profile and vote columns are understood", () => {
  assert.equal(data.profileName({ first_name: "Pat", last_name: "Baker" }), "Pat Baker");
  assert.equal(data.voteLabel({ vote: -1 }), "Boo");
  assert.equal(data.voteLabel({ vote: 1 }), "Like");
  assert.equal(data.targetType({ joke_id: 3 }), "joke");
  assert.equal(data.targetType({ generation_id: 3 }), "generation");
});
