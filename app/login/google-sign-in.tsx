"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function signIn() {
    setPending(true);
    setError(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return <>
    <button className="button" onClick={signIn} disabled={pending}>
      {pending ? "Connecting…" : "Continue with Google"}
    </button>
    {error && <p className="error" role="alert">Could not start sign-in. Please try again.</p>}
  </>;
}
