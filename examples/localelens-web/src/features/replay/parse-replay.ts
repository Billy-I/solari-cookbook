import { gunzipSync } from "node:zlib";

import type { ReplayEvent } from "./contracts";

export const MAX_REPLAY_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_REPLAY_DECODED_BYTES = 16 * 1024 * 1024;
const MAX_REPLAY_EVENTS = 20_000;
const MAX_REPLAY_DEPTH = 64;
const MAX_REPLAY_VALUES = 200_000;
const MAX_REPLAY_STRING_LENGTH = 1024 * 1024;

function invalidReplay(): Error {
  return new Error("INVALID_REPLAY");
}

function validateValue(
  value: unknown,
  depth: number,
  budget: { remaining: number },
): void {
  budget.remaining -= 1;
  if (budget.remaining < 0 || depth > MAX_REPLAY_DEPTH) throw invalidReplay();

  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidReplay();
    return;
  }
  if (typeof value === "string") {
    if (value.length > MAX_REPLAY_STRING_LENGTH) throw invalidReplay();
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) validateValue(item, depth + 1, budget);
    return;
  }
  if (typeof value !== "object") throw invalidReplay();

  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    if (key.length > 1_024) throw invalidReplay();
    validateValue(item, depth + 1, budget);
  }
}

function isReplayEvent(value: unknown): value is ReplayEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    Number.isInteger(event.type) &&
    (event.type as number) >= 0 &&
    (event.type as number) <= 6 &&
    typeof event.timestamp === "number" &&
    Number.isFinite(event.timestamp) &&
    event.timestamp >= 0 &&
    typeof event.data === "object" &&
    event.data !== null &&
    !Array.isArray(event.data)
  );
}

export function parseReplayPayload(payload: Uint8Array): ReplayEvent[] {
  if (payload.byteLength > MAX_REPLAY_DOWNLOAD_BYTES) {
    throw new Error("REPLAY_TOO_LARGE");
  }

  let decoded = payload;
  if (payload[0] === 0x1f && payload[1] === 0x8b) {
    try {
      decoded = gunzipSync(payload, { maxOutputLength: MAX_REPLAY_DECODED_BYTES });
    } catch {
      throw invalidReplay();
    }
  }
  if (decoded.byteLength > MAX_REPLAY_DECODED_BYTES) {
    throw new Error("REPLAY_TOO_LARGE");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch {
    throw invalidReplay();
  }

  const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0 || lines.length > MAX_REPLAY_EVENTS) {
    throw invalidReplay();
  }

  const budget = { remaining: MAX_REPLAY_VALUES };
  const events = lines.map((line) => {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw invalidReplay();
    }
    if (!isReplayEvent(event)) throw invalidReplay();
    validateValue(event, 0, budget);
    return event;
  });

  if (
    !events.some((event) => event.type === 4) ||
    !events.some((event) => event.type === 2)
  ) {
    throw invalidReplay();
  }

  return events;
}
