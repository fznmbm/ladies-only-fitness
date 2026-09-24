import { NextResponse, type NextRequest } from "next/server";
import { MEMBER_COOKIE, memberByToken } from "@/lib/memberAuth";

// The personal link a lady taps on WhatsApp. It signs her in on this phone, then opens her page.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const member = await memberByToken(token);

  if (!member) {
    return NextResponse.redirect(new URL("/me?problem=1", request.nextUrl.origin));
  }

  const response = NextResponse.redirect(new URL("/me", request.nextUrl.origin));
  response.cookies.set(MEMBER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
