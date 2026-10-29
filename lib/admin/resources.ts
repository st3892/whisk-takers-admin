export type Field = { key: string; label: string; kind?: "text" | "long" | "boolean" | "relation" | "chains"; required?: boolean; relation?: string };
export type Resource = { table: string; title: string; singular: string; mode: "read" | "update" | "crud"; fields: Field[]; columns: string[]; search?: string; description: string };
const name: Field = { key: "name", label: "Name", required: true };
const description: Field = { key: "description", label: "Description", kind: "long" };
const active: Field = { key: "is_active", label: "Active", kind: "boolean" };
const chain: Field = { key: "prompt_chain_id", label: "Prompt chain", kind: "relation", relation: "prompt-chains" };
export const resources: Record<string, Resource> = {
  "prompt-chains": { table: "prompt_chains", title: "Prompt Chains", singular: "Prompt chain", mode: "read", fields: [name, description, active], columns: ["name", "description", "is_active", "created_at", "updated_at"], search: "name", description: "Inspect the recipes behind generation. Open a chain to follow its steps in order." },
  "prompt-chain-steps": { table: "prompt_chain_steps", title: "Prompt Chain Steps", singular: "Chain step", mode: "read", fields: [chain, { key: "step_order", label: "Step order" }, { ...name, required: false }, { key: "prompt_template", label: "Prompt template", kind: "long" }, { key: "llm_model_id", label: "Model", kind: "relation", relation: "llm-models" }, { key: "temperature", label: "Temperature" }], columns: ["prompt_chain_id", "step_order", "name", "llm_model_id", "prompt_template", "temperature"], description: "Read-only steps, models, and prompt templates." },
  "prompt-chain-mixes": { table: "prompt_chain_mixes", title: "Chain Mixes", singular: "Chain mix", mode: "update", fields: [name, description, { key: "prompt_chain_ids", label: "Included prompt chains", kind: "chains", relation: "prompt-chains" }, active], columns: ["name", "description", "prompt_chain_ids", "is_active"], search: "name", description: "Adjust existing mixes using named prompt chains. Mix creation and deletion are unavailable." },
  terms: { table: "terms", title: "Terms", singular: "Term", mode: "crud", fields: [{ key: "term", label: "Term", required: true }, { key: "category", label: "Category" }, description, active], columns: ["term", "category", "description", "is_active"], search: "term", description: "Maintain the vocabulary used in the kitchen." },
  "generation-requests": { table: "generation_requests", title: "Generation Requests", singular: "Generation request", mode: "read", fields: [{ key: "user_id", label: "User" }, chain, { key: "input_text", label: "Input", kind: "long" }, { key: "status", label: "Status" }], columns: ["status", "prompt_chain_id", "input_text", "user_id", "created_at", "completed_at"], search: "input_text", description: "Follow request status and timing. Open a request to inspect its LLM responses." },
  "llm-responses": { table: "llm_responses", title: "LLM Responses", singular: "LLM response", mode: "read", fields: [{ key: "generation_request_id", label: "Generation request", kind: "relation", relation: "generation-requests" }, { key: "prompt_chain_step_id", label: "Chain step", kind: "relation", relation: "prompt-chain-steps" }, { key: "llm_model_id", label: "Model", kind: "relation", relation: "llm-models" }, { key: "response_text", label: "Response", kind: "long" }, { key: "latency_ms", label: "Latency (ms)" }], columns: ["generation_request_id", "prompt_chain_step_id", "llm_model_id", "response_text", "latency_ms", "created_at"], search: "response_text", description: "Inspect model output, latency, and the request and step that produced it." },
  "generation-examples": { table: "generation_examples", title: "Generation Examples", singular: "Generation example", mode: "crud", fields: [{ key: "title", label: "Title" }, { key: "input_text", label: "Input", kind: "long" }, { key: "output_text", label: "Output", kind: "long", required: true }, chain, { key: "notes", label: "Notes", kind: "long" }, active], columns: ["title", "input_text", "output_text", "prompt_chain_id", "is_active"], search: "output_text", description: "Curate reference inputs and outputs for prompt chains." },
  "llm-providers": { table: "llm_providers", title: "LLM Providers", singular: "LLM provider", mode: "crud", fields: [name, description, active], columns: ["name", "description", "is_active", "updated_at"], search: "name", description: "Maintain the providers available to model configuration." },
  "llm-models": { table: "llm_models", title: "LLM Models", singular: "LLM model", mode: "crud", fields: [{ key: "provider_id", label: "Provider", kind: "relation", relation: "llm-providers" }, name, { key: "model_key", label: "Model key" }, description, { key: "supports_temperature", label: "Supports temperature", kind: "boolean" }, active], columns: ["name", "provider_id", "model_key", "supports_temperature", "is_active"], search: "name", description: "Configure models and their provider relationships." },
  "allowed-signup-domains": { table: "allowed_signup_domains", title: "Allowed Domains", singular: "Signup domain", mode: "crud", fields: [{ key: "domain", label: "Domain", required: true }, active], columns: ["domain", "is_active", "created_at"], search: "domain", description: "Manage domains permitted by the existing signup rules." },
  "whitelisted-emails": { table: "whitelisted_emails", title: "Whitelisted Emails", singular: "Whitelisted email", mode: "crud", fields: [{ key: "email", label: "Email", required: true }, { key: "note", label: "Note", kind: "long" }, active], columns: ["email", "note", "is_active", "created_at"], search: "email", description: "Manage individual signup exceptions." },
};
export function getResource(slug: string): Resource | undefined {
  return Object.hasOwn(resources, slug) ? resources[slug] : undefined;
}
export function recordId(value: unknown): string | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  const raw = typeof value === "number" ? String(value) : value;
  return typeof raw === "string" && /^-?\d{1,19}$/.test(raw) && BigInt(raw) >= BigInt("-9223372036854775808") && BigInt(raw) <= BigInt("9223372036854775807") ? raw : null;
}
export type ResourceState = { error?: string; success?: string };
export function resourceInput(config: Resource, form: FormData): { values: Record<string, unknown>; error?: never } | { error: string; values?: never } {
  const values: Record<string, unknown> = {};
  for (const field of config.fields) {
    if (field.kind === "boolean") { values[field.key] = form.get(field.key) === "on"; continue; }
    if (field.kind === "chains") {
      const ids = form.getAll(field.key).map(recordId);
      if (ids.some(id => id === null)) return { error: "Invalid prompt chain selection." };
      values[field.key] = [...new Set(ids)]; continue;
    }
    const raw = form.get(field.key);
    if (typeof raw !== "string") return { error: `Invalid ${field.label.toLowerCase()}.` };
    const value = raw.trim();
    if (field.required && !value) return { error: `${field.label} is required.` };
    if (value.length > 50000) return { error: `${field.label} exceeds 50,000 characters.` };
    if (field.kind === "relation" && value && !recordId(value)) return { error: `Invalid ${field.label.toLowerCase()}.` };
    values[field.key] = value || null;
  }
  if (config.table === "allowed_signup_domains") {
    const domain = String(values.domain).toLowerCase();
    if (domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return { error: "Enter a domain such as columbia.edu, without @ or a URL." };
    values.domain = domain;
  }
  if (config.table === "whitelisted_emails") {
    const email = String(values.email).toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
    values.email = email;
  }
  return { values };
}
