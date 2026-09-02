import { NextResponse, type NextRequest } from "next/server";

const captureMethods = ["POST", "OPTIONS"];
const replayMethods = ["GET", "HEAD", "OPTIONS"];

export function proxy(request: NextRequest): Response {
  const isCaptureRoute = request.nextUrl.pathname === "/api/captures";
  const allowedMethods = isCaptureRoute ? captureMethods : replayMethods;

  if (allowedMethods.includes(request.method)) {
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
  matcher: ["/api/captures", "/api/replays/:path*"],
};
