import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
function load(path, dependencies = {}) {
  const context = { exports: {}, FormData, URLSearchParams, Date, BigInt, require(name) {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return context.exports;
}
const registry = load("../lib/admin/resources.ts");
const data = load("../lib/admin/data.ts", { "server-only": {} });
function form(values = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) for (const entry of Array.isArray(value) ? value : [value]) result.append(key, entry);
  return result;
}
function setup({ denied = false, error = null, rows = [{ id: 42 }] } = {}) {
  const calls = [];
  const query = {
    insert(values) { calls.push(["insert", values]); return this; },
    update(values) { calls.push(["update", values]); return this; },
    delete() { calls.push(["delete"]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    select() { return this; },
    then(resolve, reject) { return Promise.resolve({ data: rows, error }).then(resolve, reject); },
  };
  const actions = load("../app/admin/resources/actions.ts", {
    "next/cache": { revalidatePath(path) { calls.push(["revalidate", path]); } },
    "@/lib/auth/require-admin": { async requireAdmin() {
      calls.push(["authorize"]);
      if (denied) throw new Error("Unauthorized");
      return { supabase: { from(table) { calls.push(["from", table]); return query; } } };
    } },
    "@/lib/admin/data": data,
    "@/lib/admin/resources": registry,
  });
  return { mutate: actions.mutateResource, calls };
}
const inputs = {
  terms: { term: "  Punchline  ", category: "Wordplay", description: "A term", is_active: "on" },
  "prompt-chain-mixes": { name: "Mix", description: "", prompt_chain_ids: ["1", "2"], is_active: "on" },
  "generation-examples": { title: "Example", input_text: "Input", output_text: "Output", prompt_chain_id: "2", notes: "", is_active: "on" },
  "llm-models": { provider_id: "1", name: "Model", model_key: "model-key", description: "", supports_temperature: "on", is_active: "on" },
  "llm-providers": { name: "Provider", description: "", is_active: "on" },
  "allowed-signup-domains": { domain: "Columbia.edu", is_active: "on" },
  "whitelisted-emails": { email: "Admin@Columbia.edu", note: "", is_active: "on" },
};
for (const slug of Object.keys(registry.resources)) {
  test(`${slug}: mutations require the server-side admin guard`, async () => {
    for (const operation of ["create", "update", "delete"]) {
      const { mutate, calls } = setup({ denied: true });
      await assert.rejects(mutate(slug, operation, {}, form()), /Unauthorized/);
      assert.deepEqual(calls, [["authorize"]]);
    }
  });
  const config = registry.getResource(slug);
  if (config.mode === "read" || config.mode === "update") test(`${slug}: prohibited operations cannot reach the database`, async () => {
    for (const operation of config.mode === "read" ? ["create", "update", "delete"] : ["create", "delete"]) {
      const { mutate, calls } = setup();
      assert.ok((await mutate(slug, operation, {}, form({ id: "42", confirmation: "42", ...inputs[slug] }))).error);
      assert.deepEqual(calls, [["authorize"]]);
    }
  });
}
for (const [slug, values] of Object.entries(inputs)) {
  const config = registry.getResource(slug);
  for (const operation of config.mode === "crud" ? ["create", "update", "delete"] : ["update"]) {
    test(`${slug}: ${operation} uses allowlisted fields and exact ID`, async () => {
      const { mutate, calls } = setup();
      const result = await mutate(slug, operation, {}, form({ ...values, id: "42", confirmation: "42", is_superadmin: "true", user_id: "attacker", created_at: "fake" }));
      assert.ok(result.success, result.error);
      assert.equal(calls[0][0], "authorize");
      assert.deepEqual(calls.filter(call => call[0] === "from"), [["from", config.table]]);
      if (operation !== "create") assert.ok(calls.some(call => call[0] === "eq" && call[1] === "id" && call[2] === "42"));
      if (operation !== "delete") {
        const saved = calls.find(call => call[0] === (operation === "create" ? "insert" : "update"))[1];
        assert.equal("is_superadmin" in saved, false);
        assert.equal("user_id" in saved, false);
        assert.equal("created_at" in saved, false);
        assert.deepEqual(Object.keys(saved).sort(), [...config.fields.map(field => field.key), ...(operation === "create" ? ["id"] : [])].sort());
      }
    });
  }
}
test("forged resources and operations never reach Supabase", async () => {
  for (const [slug, operation] of [["profiles", "update"], ["__proto__", "create"], ["constructor", "delete"], ["terms", "upsert"]]) {
    const { mutate, calls } = setup();
    assert.ok((await mutate(slug, operation, {}, form())).error);
    assert.deepEqual(calls, [["authorize"]]);
  }
});
test("invalid input and unconfirmed deletion cannot mutate", async () => {
  for (const [slug, operation, values] of [
    ["terms", "create", { ...inputs.terms, term: " " }],
    ["terms", "update", { ...inputs.terms, id: "42 OR 1=1" }],
    ["terms", "delete", { id: "42", confirmation: "41" }],
    ["llm-models", "create", { ...inputs["llm-models"], provider_id: "bad-id" }],
    ["prompt-chain-mixes", "update", { ...inputs["prompt-chain-mixes"], id: "42", prompt_chain_ids: ["1", "bad"] }],
    ["allowed-signup-domains", "create", { domain: "https://example.com" }],
    ["whitelisted-emails", "create", { email: "not-an-email" }],
  ]) {
    const { mutate, calls } = setup();
    assert.ok((await mutate(slug, operation, {}, form(values))).error);
    assert.deepEqual(calls, [["authorize"]]);
  }
});
test("RLS and foreign-key errors are surfaced without revalidation", async () => {
  for (const operation of ["create", "update", "delete"]) for (const code of ["42501", "23503"]) {
    const { mutate, calls } = setup({ error: { code, message: "Denied" } });
    assert.match((await mutate("terms", operation, {}, form({ ...inputs.terms, id: "42", confirmation: "42" }))).error, code === "42501" ? /RLS/ : /foreign-key/);
    assert.equal(calls.some(call => call[0] === "revalidate"), false);
  }
});
test("zero-row mutations never report success", async () => {
  for (const operation of ["create", "update", "delete"]) {
    const { mutate } = setup({ rows: [] });
    assert.match((await mutate("terms", operation, {}, form({ ...inputs.terms, id: "42", confirmation: "42" }))).error, /No record/);
  }
});
test("bigint bounds, null fields, booleans and chain arrays are parsed safely", () => {
  assert.equal(registry.recordId("9223372036854775807"), "9223372036854775807");
  assert.equal(registry.recordId("9223372036854775808"), null);
  assert.equal(registry.recordId(Number.MAX_SAFE_INTEGER + 1), null);
  const mix = registry.resourceInput(registry.getResource("prompt-chain-mixes"), form({ name: " Mix ", description: "", prompt_chain_ids: ["1", "1", "2"] }));
  assert.equal(mix.values.name, "Mix");
  assert.equal(mix.values.description, null);
  assert.equal(mix.values.is_active, false);
  assert.equal(JSON.stringify(mix.values.prompt_chain_ids), '["1","2"]');
});
const queries = load("../lib/admin/resource-data.ts", { "server-only": {}, "./data": data, "./resources": registry });
test("filtered list queries preserve restrictions and stable pagination", async () => {
  const calls = [];
  const query = {};
  for (const method of ["select", "ilike", "eq", "order", "range"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.then = resolve => resolve({ data: [], count: 0, error: null });
  const supabase = { from: () => query };
  await queries.resourcePage(supabase, registry.getResource("llm-responses"), 2, { request: "42", model: "7", q: "100%_" });
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "generation_request_id" && call[2] === "42"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "llm_model_id" && call[2] === "7"));
  assert.deepEqual(calls.find(call => call[0] === "range"), ["range", 25, 49]);
  assert.equal(calls.find(call => call[0] === "ilike")[2], "%100\\%\\_%");
  const invalid = await queries.resourcePage(supabase, registry.getResource("llm-responses"), 1, { request: "bad" });
  assert.match(invalid.error, /Invalid request/);
});
test("unsafe foreign IDs prevent relationship editing", async () => {
  const config = registry.getResource("llm-models");
  const result = await queries.relationshipOptions({}, config, [{ provider_id: Number.MAX_SAFE_INTEGER + 1 }]);
  assert.match(result.errors.join(" "), /cannot be represented safely/);
});
const link = { default: ({ children, href, ...props }) => createElement("a", { href, ...props }, children) };
const components = {
  PageHeading: ({ title, description }) => createElement("header", null, title, description),
  Notice: ({ children }) => createElement("aside", null, children),
  LongText: ({ value }) => createElement("span", null, String(value ?? "")),
};
const view = load("../app/admin/resources/view.tsx", {
  "next/link": link, "@/lib/admin/data": data, "@/lib/admin/resources": registry, "../components": components,
});
function pageSetup({ denied = false, relationshipErrors = [] } = {}) {
  const calls = [];
  const rows = [{ id: 42, name: "House recipe", term: "Wordplay", output_text: "Output", prompt_chain_ids: [1], is_active: true }];
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { calls.push("read"); return { data: rows[0], error: null }; } };
  const deps = {
    "next/link": link,
    "next/navigation": { notFound() { throw new Error("Not found"); } },
    "@/lib/auth/require-admin": { async requireAdmin() { calls.push("authorize"); if (denied) throw new Error("Unauthorized"); return { supabase: { from() { return query; } } }; } },
    "@/lib/admin/resources": registry,
    "@/lib/admin/data": data,
    "@/lib/admin/resource-data": {
      async resourcePage() { calls.push("list"); return { rows: [], count: 0, error: null }; },
      async relationshipOptions() { return { options: { "prompt-chains": [{ id: "1", label: "Named chain" }] }, errors: relationshipErrors }; },
    },
  };
  const forms = {
    ResourceForm: ({ row }) => createElement("form", null, row ? "EDIT FORM" : "CREATE FORM"),
    DeleteResource: () => createElement("form", null, "DELETE FORM"),
  };
  const list = load("../app/admin/[resource]/page.tsx", { ...deps, "../components": components, "../resources/forms": forms, "../resources/view": view }).default;
  const detail = load("../app/admin/[resource]/[id]/page.tsx", { ...deps, "../../components": components, "../../resources/forms": forms, "../../resources/view": view }).default;
  return { list, detail, calls };
}
test("both new page entry points reject unauthorized users before reading data", async () => {
  for (const name of ["list", "detail"]) {
    const pages = pageSetup({ denied: true });
    await assert.rejects(pages[name]({ params: Promise.resolve({ resource: "terms", id: "42" }), searchParams: Promise.resolve({}) }), /Unauthorized/);
    assert.deepEqual(pages.calls, ["authorize"]);
  }
});
test("rendered pages expose only each resource's permitted controls", async () => {
  for (const [slug, config] of Object.entries(registry.resources)) {
    const pages = pageSetup();
    const props = { params: Promise.resolve({ resource: slug, id: "42" }), searchParams: Promise.resolve({}) };
    const list = renderToStaticMarkup(await pages.list(props));
    const detail = renderToStaticMarkup(await pages.detail(props));
    assert.equal(list.includes("CREATE FORM"), config.mode === "crud", slug);
    assert.equal(detail.includes("EDIT FORM"), config.mode !== "read", slug);
    assert.equal(detail.includes("DELETE FORM"), config.mode === "crud", slug);
    if (slug === "prompt-chains") assert.match(detail, /Step sequence/);
    if (slug === "generation-requests") assert.match(detail, /Associated LLM responses/);
  }
});
test("relationship-load failures disable create and edit controls", async () => {
  const pages = pageSetup({ relationshipErrors: ["Choices denied by RLS"] });
  const props = { params: Promise.resolve({ resource: "llm-models", id: "42" }), searchParams: Promise.resolve({}) };
  assert.doesNotMatch(renderToStaticMarkup(await pages.list(props)), /CREATE FORM/);
  const detail = renderToStaticMarkup(await pages.detail(props));
  assert.doesNotMatch(detail, /EDIT FORM/);
  assert.match(detail, /Choices denied by RLS/);
});
test("relationship labels and pagination links use names and retain filters", () => {
  const html = renderToStaticMarkup(createElement(view.Value, { config: registry.getResource("prompt-chain-mixes"), column: "prompt_chain_ids", value: [1], options: { "prompt-chains": [{ id: "1", label: "Bakery chain" }] } }));
  assert.match(html, /Bakery chain/);
  assert.match(html, /href="\/admin\/prompt-chains\/1"/);
  const pages = renderToStaticMarkup(createElement(view.ResourcePagination, { base: "/admin/llm-responses", page: 2, count: 75, filters: { request: "42", model: "7", q: "test" } }));
  assert.match(pages, /request=42&amp;model=7&amp;q=test&amp;page=3/);
});
