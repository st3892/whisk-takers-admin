import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.searchParams.has("error")) {
    const supabase = await createClient();
    // PKCE exchange requires the verifier cookie from the initiating browser.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL("/admin", request.url), 303);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  // Fixed local destinations prevent open redirects. Never echo provider errors.
  const response = NextResponse.redirect(new URL("/login?error=callback", request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
