import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getAdminAccess } from "@/lib/auth/access";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    const access = await getAdminAccess(supabase);
    if (access.status !== "authorized") {
      const destination = request.nextUrl.clone();
      destination.pathname = access.status === "logged-out" ? "/login" : "/unauthorized";
      destination.search = "";
      const redirect = NextResponse.redirect(destination, 303);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      response = redirect;
    }
  } else {
    // Validate and refresh the cookie session on public auth pages too.
    await supabase.auth.getUser();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/unauthorized", "/auth/:path*"],
};
