"use client";

import { ExternalLink, LoaderCircle, RotateCcw, Unlink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ReplayState =
  | { status: "pending" }
  | { status: "ready"; replayUrl: string }
  | { status: "unavailable" };

type SessionReplayState = {
  sessionId: string;
  result: ReplayState;
};

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
  const [state, setState] = useState<SessionReplayState>({
    result: { status: "pending" },
    sessionId,
  });
  const [recheckCount, setRecheckCount] = useState(0);
  const lookedUpSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (lookedUpSessionRef.current === sessionId && recheckCount === 0) return;

    let controller: AbortController | undefined;
    const lookupTimer = window.setTimeout(() => {
      lookedUpSessionRef.current = sessionId;
      const lookupController = new AbortController();
      controller = lookupController;
      setState({ result: { status: "pending" }, sessionId });

      void fetch(`/api/replays/${encodeURIComponent(sessionId)}`, {
        signal: lookupController.signal,
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
          if (!lookupController.signal.aborted) {
            setState({ result: nextState, sessionId });
          }
        })
        .catch(() => {
          if (!lookupController.signal.aborted) {
            setState({ result: { status: "unavailable" }, sessionId });
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(lookupTimer);
      controller?.abort();
    };
  }, [recheckCount, sessionId]);

  const result: ReplayState =
    state.sessionId === sessionId ? state.result : { status: "pending" };

  function recheck() {
    setState({ result: { status: "pending" }, sessionId });
    setRecheckCount((count) => count + 1);
  }

  if (result.status === "ready") {
    return (
      <a
        className="replay-link"
        href={result.replayUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" size={16} />
        Open replay
      </a>
    );
  }

  if (result.status === "pending") {
    return (
      <div className="replay-pending">
        <span className="replay-state">
          <LoaderCircle aria-hidden="true" size={16} />
          Replay pending
        </span>
        <button className="secondary-action" onClick={recheck} type="button">
          <RotateCcw aria-hidden="true" size={16} />
          Re-check replay
        </button>
      </div>
    );
  }

  return (
    <span className="replay-state">
      <Unlink aria-hidden="true" size={16} />
      Replay unavailable
    </span>
  );
}
