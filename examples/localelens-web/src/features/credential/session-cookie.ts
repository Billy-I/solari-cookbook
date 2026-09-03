import { type NextRequest, type NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "localelens_session";

export function readSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  secure: boolean,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure,
  });
}

export function clearSessionCookie(
  response: NextResponse,
  secure: boolean,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure,
    maxAge: 0,
  });
}
