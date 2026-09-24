import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that don't need the organiser to be signed in.
// "/" decides for itself where to send people. /me and /m/ use the ladies' personal link.
function isPublic(path: string): boolean {
  return (
    path === "/" ||
    path.startsWith("/join") ||
    path.startsWith("/m/") ||
    path.startsWith("/me") ||
    path === "/manifest.webmanifest"
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isPublic(path)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const onLogin = path.startsWith("/login");
  if (!user && !onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/sessions";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
