export type ActionState = { error?: string; success?: string };
export function generationInput(form: FormData) {
  const prompt = form.get("prompt");
  const generated_text = form.get("generated_text");
  if (typeof prompt !== "string" || !prompt.trim() || typeof generated_text !== "string" || !generated_text.trim()) {
    return { error: "Enter both a prompt and generated text." } as const;
  }
  if (prompt.length > 20000 || generated_text.length > 50000) {
    return { error: "Use at most 20,000 characters for the prompt and 50,000 for generated text." } as const;
  }
  return { values: { prompt: prompt.trim(), generated_text: generated_text.trim() } } as const;
}
export function generationId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) return null;
  return BigInt(value) <= BigInt("9223372036854775807") ? value : null;
}
