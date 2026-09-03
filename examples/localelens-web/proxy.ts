import { NextResponse, type NextRequest } from "next/server";

const methodsByPath = {
  "/api/captures": ["POST", "OPTIONS"],
  "/api/solari-session": ["GET", "POST", "DELETE", "OPTIONS"],
} as const;
const replayMethods = ["GET", "OPTIONS"] as const;

export function proxy(request: NextRequest): Response {
  const allowedMethods =
    methodsByPath[request.nextUrl.pathname as keyof typeof methodsByPath] ??
    replayMethods;

  if (allowedMethods.some((method) => method === request.method)) {
    return NextResponse.next();
  }

  return Response.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed.",
      },
    },
    {
      headers: {
        Allow: allowedMethods.join(", "),
        "Cache-Control": "private, no-store",
      },
      status: 405,
    },
  );
}

export const config = {
  matcher: [
    "/api/captures",
    "/api/replays/:path*",
    "/api/solari-session",
  ],
};
