import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  MAX_REPLAY_DOWNLOAD_BYTES,
  parseReplayPayload,
} from "@/src/features/replay/parse-replay";
import type { ReplayEvent } from "@/src/features/replay/contracts";

const events: ReplayEvent[] = [
  { type: 4, timestamp: 1_000, data: { href: "https://example.com/" } },
  { type: 2, timestamp: 1_001, data: { node: { type: 0, childNodes: [] } } },
  { type: 3, timestamp: 1_002, data: { source: 0 } },
];

function ndjsonBytes(value = events): Uint8Array {
  return new TextEncoder().encode(
    `${value.map((event) => JSON.stringify(event)).join("\n")}\n`,
  );
}

describe("parseReplayPayload", () => {
  it("accepts plain NDJSON even when the provider labels it as gzip", () => {
    expect(parseReplayPayload(ndjsonBytes())).toEqual(events);
  });

  it("decompresses a payload only when gzip magic bytes are present", () => {
    expect(parseReplayPayload(gzipSync(ndjsonBytes()))).toEqual(events);
  });

  it("requires a replay meta event and full snapshot", () => {
    expect(() => parseReplayPayload(ndjsonBytes(events.slice(2)))).toThrow(
      "INVALID_REPLAY",
    );
  });

  it("rejects malformed and deeply nested replay data", () => {
    expect(() => parseReplayPayload(new TextEncoder().encode("not-json\n"))).toThrow(
      "INVALID_REPLAY",
    );

    let nested: Record<string, unknown> = {};
    for (let depth = 0; depth < 70; depth += 1) nested = { child: nested };
    expect(() =>
      parseReplayPayload(ndjsonBytes([
        events[0]!,
        { type: 2, timestamp: 1_001, data: nested },
      ])),
    ).toThrow("INVALID_REPLAY");
  });

  it("rejects a download beyond the explicit byte limit", () => {
    expect(() =>
      parseReplayPayload(new Uint8Array(MAX_REPLAY_DOWNLOAD_BYTES + 1)),
    ).toThrow("REPLAY_TOO_LARGE");
  });
});
