import { describe, expect, it, vi } from "vitest";

import { validatePublicUrl } from "@/src/features/capture/validate-public-url";

const publicIpv4 = "93.184.216.34";
const publicIpv6 = "2606:2800:220:1:248:1893:25c8:1946";

describe("validatePublicUrl", () => {
  it.each([
    ["not a URL", "INVALID_INPUT"],
    ["http://example.com/", "INVALID_INPUT"],
    ["ftp://example.com/", "INVALID_INPUT"],
    ["https://user:password@example.com/", "INVALID_INPUT"],
    ["https://example.com/path#fragment", "INVALID_INPUT"],
    ["https://example.com:444/", "INVALID_INPUT"],
  ])("rejects invalid public target %s", async (rawUrl, reason) => {
    const resolveHost = vi.fn().mockResolvedValue([publicIpv4]);

    await expect(validatePublicUrl(rawUrl, resolveHost)).rejects.toThrow(reason);
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it.each([
    "https://localhost/",
    "https://api.localhost/",
    "https://printer.local/",
  ])("rejects local hostname %s", async (rawUrl) => {
    const resolveHost = vi.fn().mockResolvedValue([publicIpv4]);

    await expect(validatePublicUrl(rawUrl, resolveHost)).rejects.toThrow(
      "PRIVATE_TARGET_BLOCKED",
    );
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it.each([
    "0.0.0.0",
    "10.20.30.40",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
  ])("rejects non-public IPv4 address %s", async (address) => {
    await expect(
      validatePublicUrl(`https://${address}/`, vi.fn()),
    ).rejects.toThrow("PRIVATE_TARGET_BLOCKED");
  });

  it.each([
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "64:ff9b::1",
    "64:ff9b:1::1",
    "100::1",
    "2001:db8::1",
    "2002::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
  ])("rejects non-public IPv6 address %s", async (address) => {
    await expect(
      validatePublicUrl(`https://[${address}]/`, vi.fn()),
    ).rejects.toThrow("PRIVATE_TARGET_BLOCKED");
  });

  it("rejects a hostname when any DNS answer is non-public", async () => {
    const resolveHost = vi
      .fn()
      .mockResolvedValue([publicIpv4, "10.0.0.7", publicIpv6]);

    await expect(
      validatePublicUrl("https://example.com/", resolveHost),
    ).rejects.toThrow("PRIVATE_TARGET_BLOCKED");
  });

  it.each([[[]], [["not-an-ip-address"]]])(
    "rejects unusable DNS answers %j",
    async (addresses) => {
      const resolveHost = vi.fn().mockResolvedValue(addresses);

      await expect(
        validatePublicUrl("https://example.com/", resolveHost),
      ).rejects.toThrow("PRIVATE_TARGET_BLOCKED");
    },
  );

  it("accepts a public dual-stack hostname and explicit default port", async () => {
    const resolveHost = vi.fn().mockResolvedValue([publicIpv4, publicIpv6]);

    const result = await validatePublicUrl(
      "https://example.com:443/path?view=compact",
      resolveHost,
    );

    expect(result.href).toBe("https://example.com/path?view=compact");
    expect(resolveHost).toHaveBeenCalledWith("example.com");
  });

  it("accepts a public IP literal without DNS resolution", async () => {
    const resolveHost = vi.fn();

    const result = await validatePublicUrl(
      `https://${publicIpv4}/`,
      resolveHost,
    );

    expect(result.hostname).toBe(publicIpv4);
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it("accepts a public IPv6 literal without DNS resolution", async () => {
    const resolveHost = vi.fn();

    const result = await validatePublicUrl(
      `https://[${publicIpv6}]/`,
      resolveHost,
    );

    expect(result.hostname).toBe(`[${publicIpv6}]`);
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it("normalizes a Unicode hostname before resolution", async () => {
    const resolveHost = vi.fn().mockResolvedValue([publicIpv4]);

    const result = await validatePublicUrl("https://bücher.de/", resolveHost);

    expect(result.hostname).toBe("xn--bcher-kva.de");
    expect(resolveHost).toHaveBeenCalledWith("xn--bcher-kva.de");
  });
});
