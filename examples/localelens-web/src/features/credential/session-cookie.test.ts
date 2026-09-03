import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import {
  clearSessionCookie,
  readSessionToken,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "@/src/features/credential/session-cookie";

describe("credential session cookie", () => {
  it("sets an opaque browser-session cookie without persistence or Domain", () => {
    const response = new NextResponse(null);

    setSessionCookie(response, "opaque-token", false);

    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining(
        "localelens_session=opaque-token; Path=/; HttpOnly; SameSite=strict",
      ),
    ]);
    expect(response.headers.getSetCookie()[0]).not.toContain("Max-Age");
    expect(response.headers.getSetCookie()[0]).not.toContain("Expires");
    expect(response.headers.getSetCookie()[0]).not.toContain("Domain");
    expect(response.headers.getSetCookie()[0]).not.toContain("Secure");
  });

  it("adds Secure for hosted production responses", () => {
    const response = new NextResponse(null);

    setSessionCookie(response, "opaque-token", true);

    expect(response.headers.getSetCookie()[0]).toContain("; Secure;");
  });

  it("reads only the named cookie from NextRequest", () => {
    const request = new NextRequest("http://localhost/api/solari-session", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=opaque-token; unrelated=value`,
      },
    });

    expect(readSessionToken(request)).toBe("opaque-token");
    expect(
      readSessionToken(
        new NextRequest("http://localhost/api/solari-session", {
          headers: { cookie: "unrelated=value" },
        }),
      ),
    ).toBeNull();
  });

  it("clears with matching scope and immediate expiry", () => {
    const response = new NextResponse(null);

    clearSessionCookie(response, true);

    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining(
        "localelens_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=strict",
      ),
    ]);
    expect(response.headers.getSetCookie()[0]).not.toContain("Domain");
  });
});
