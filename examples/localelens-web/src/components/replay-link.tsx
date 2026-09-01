"use client";

import { ExternalLink, LoaderCircle, Unlink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ReplayState =
  | { status: "pending" }
  | { status: "ready"; replayUrl: string }
  | { status: "unavailable" };

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function isSafeReplayUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      (url.port === "" || url.port === "443")
    );
  } catch {
    return false;
  }
}

function parseReplayResponse(status: number, body: unknown): ReplayState {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { status: "unavailable" };
  }

  const response = body as Record<string, unknown>;
  if (status === 202 && hasOnlyKeys(response, ["status"]) && response.status === "pending") {
    return { status: "pending" };
  }
  if (
    status === 200 &&
    hasOnlyKeys(response, ["status", "replayUrl"]) &&
    response.status === "ready" &&
    isSafeReplayUrl(response.replayUrl)
  ) {
    return { status: "ready", replayUrl: response.replayUrl };
  }

  return { status: "unavailable" };
}

type ReplayLinkProps = {
  sessionId: string;
};

export function ReplayLink({ sessionId }: ReplayLinkProps) {
  const [state, setState] = useState<ReplayState>({ status: "pending" });
  const lookedUpSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (lookedUpSessionRef.current === sessionId) return;

    lookedUpSessionRef.current = sessionId;
    const controller = new AbortController();
    setState({ status: "pending" });

    void fetch(`/api/replays/${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return { status: "unavailable" } satisfies ReplayState;
        }
        return parseReplayResponse(response.status, body);
      })
      .then((nextState) => {
        if (!controller.signal.aborted) setState(nextState);
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "unavailable" });
      });

    return () => controller.abort();
  }, [sessionId]);

  if (state.status === "ready") {
    return (
      <a
        className="replay-link"
        href={state.replayUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" size={16} />
        Open replay
      </a>
    );
  }

  if (state.status === "pending") {
    return (
      <span className="replay-state">
        <LoaderCircle aria-hidden="true" size={16} />
        Replay pending
      </span>
    );
  }

  return (
    <span className="replay-state">
      <Unlink aria-hidden="true" size={16} />
      Replay unavailable
    </span>
  );
}
