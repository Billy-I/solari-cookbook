import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolveHost = (hostname: string) => Promise<readonly string[]>;

const blockedIpv4Ranges = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const;

const blockedIpv6Ranges = [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const;

function invalidInput(): Error {
  return new Error("INVALID_INPUT");
}

function privateTarget(): Error {
  return new Error("PRIVATE_TARGET_BLOCKED");
}

function ipv4ToNumber(address: string): number {
  return address
    .split(".")
    .reduce((value, part) => value * 256 + Number(part), 0);
}

function isIpv4InRange(address: string, base: string, prefix: number): boolean {
  const host = ipv4ToNumber(address);
  const network = ipv4ToNumber(base);
  const divisor = 2 ** (32 - prefix);

  return Math.floor(host / divisor) === Math.floor(network / divisor);
}

function expandIpv6Parts(address: string): string[] {
  const [left = "", right = ""] = address.toLowerCase().split("::");
  const expandSide = (side: string): string[] => {
    if (!side) return [];

    const parts = side.split(":");
    const last = parts.at(-1);
    if (last?.includes(".")) {
      const ipv4 = ipv4ToNumber(last);
      parts.splice(
        -1,
        1,
        ((ipv4 >>> 16) & 0xffff).toString(16),
        (ipv4 & 0xffff).toString(16),
      );
    }

    return parts;
  };

  const leftParts = expandSide(left);
  const rightParts = expandSide(right);
  const omitted = 8 - leftParts.length - rightParts.length;

  return [...leftParts, ...Array(Math.max(omitted, 0)).fill("0"), ...rightParts];
}

function isIpv6InRange(address: string, base: string, prefix: number): boolean {
  const addressParts = expandIpv6Parts(address).map((part) =>
    Number.parseInt(part || "0", 16),
  );
  const baseParts = expandIpv6Parts(base).map((part) =>
    Number.parseInt(part || "0", 16),
  );
  const completeParts = Math.floor(prefix / 16);

  for (let index = 0; index < completeParts; index += 1) {
    if (addressParts[index] !== baseParts[index]) return false;
  }

  const remainingBits = prefix % 16;
  if (remainingBits === 0) return true;

  const mask = (0xffff << (16 - remainingBits)) & 0xffff;
  return (
    ((addressParts[completeParts] ?? 0) & mask) ===
    ((baseParts[completeParts] ?? 0) & mask)
  );
}

function isPublicIp(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    return !blockedIpv4Ranges.some(([base, prefix]) =>
      isIpv4InRange(address, base, prefix),
    );
  }

  if (version === 6) {
    return !blockedIpv6Ranges.some(([base, prefix]) =>
      isIpv6InRange(address, base, prefix),
    );
  }

  return false;
}

async function resolveSystemHost(hostname: string): Promise<readonly string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address }) => address);
}

export async function validatePublicUrl(
  rawUrl: string,
  resolveHost: ResolveHost = resolveSystemHost,
): Promise<URL> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw invalidInput();
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  ) {
    throw invalidInput();
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const bareHostname = hostname.replace(/^\[|\]$/g, "");

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw privateTarget();
  }

  const ipVersion = isIP(bareHostname);
  if (ipVersion) {
    if (!isPublicIp(bareHostname)) throw privateTarget();
  } else {
    const addresses = await resolveHost(hostname);
    if (addresses.length === 0 || addresses.some((address) => !isPublicIp(address))) {
      throw privateTarget();
    }
  }

  url.hostname = hostname;
  return url;
}
