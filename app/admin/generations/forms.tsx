"use client";
import { useActionState } from "react";
import { createGeneration, updateGeneration, deleteGeneration } from "./actions";
import type { ActionState } from "@/lib/admin/generation-input";
const initial: ActionState = {};
function Feedback({ state }: { state: ActionState }) {
  return <>{state.error && <p className="notice" role="alert">{state.error}</p>}{state.success && <p className="success" role="status">{state.success}</p>}</>;
}
export function GenerationForm({ generation }: { generation?: { id: string; prompt: string; generated_text: string } }) {
  const [state, action, pending] = useActionState(generation ? updateGeneration : createGeneration, initial);
  return <form action={action} className="generation-form" aria-busy={pending}>
    {generation ? <input type="hidden" name="id" value={generation.id}/> : <label>Record ID <span className="muted">(optional if the database generates it)</span><input name="id" inputMode="numeric" pattern="[1-9][0-9]*" placeholder="Use database default"/></label>}
    <label>Prompt<textarea name="prompt" required maxLength={20000} rows={3} defaultValue={generation?.prompt}/></label>
    <label>Generated text<textarea name="generated_text" required maxLength={50000} rows={4} defaultValue={generation?.generated_text}/></label>
    <Feedback state={state}/><button aria-label={generation ? `Save changes to generation ${generation.id}` : "Create generation record"} className="button compact" disabled={pending} type="submit">{pending ? "Saving…" : generation ? "Save changes" : "Create record"}</button>
  </form>;
}
export function DeleteGeneration({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteGeneration, initial);
  return <details className="delete-details"><summary aria-label={`Delete generation ${id}`}>Delete record…</summary><form action={action} className="generation-form" aria-busy={pending}><input type="hidden" name="id" value={id}/><p>This permanently deletes generation {id}. Related votes follow the existing database rules: deletion may be blocked, or votes may cascade if configured in the database.</p><label>Type {id} to confirm<input name="confirmation" required autoComplete="off" pattern={id}/></label><Feedback state={state}/><button type="submit" aria-label={`Permanently delete generation ${id}`} className="button danger compact" disabled={pending}>{pending ? "Deleting…" : "Permanently delete"}</button></form></details>;
}
