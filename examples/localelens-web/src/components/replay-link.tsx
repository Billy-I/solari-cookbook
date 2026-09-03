"use client";

import { ExternalLink, LoaderCircle, RotateCcw, Unlink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CaptureCorrelation } from "@/src/features/capture/contracts";

type ReplayState =
  | { status: "pending" }
  | { status: "ready"; replayUrl: string }
  | { status: "unavailable" };

type SessionReplayState = {
  correlationKey: string;
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
  correlation: CaptureCorrelation;
};

export function ReplayLink({ correlation }: ReplayLinkProps) {
  const correlationKey = `${correlation.runId}:${correlation.country}:${correlation.attempt}:${correlation.sessionRef}`;
  const [state, setState] = useState<SessionReplayState>({
    correlationKey,
    result: { status: "pending" },
  });
  const [recheckCount, setRecheckCount] = useState(0);
  const lookedUpCorrelationRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      lookedUpCorrelationRef.current === correlationKey &&
      recheckCount === 0
    ) {
      return;
    }

    let controller: AbortController | undefined;
    const lookupTimer = window.setTimeout(() => {
      lookedUpCorrelationRef.current = correlationKey;
      const lookupController = new AbortController();
      controller = lookupController;
      setState({ correlationKey, result: { status: "pending" } });
      const query = new URLSearchParams({
        runId: correlation.runId,
        country: correlation.country,
        attempt: String(correlation.attempt),
      });

      void fetch(`/api/replays/${correlation.sessionRef}?${query}`, {
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
            setState({ correlationKey, result: nextState });
          }
        })
        .catch(() => {
          if (!lookupController.signal.aborted) {
            setState({ correlationKey, result: { status: "unavailable" } });
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(lookupTimer);
      controller?.abort();
    };
  }, [
    correlation.attempt,
    correlation.country,
    correlation.runId,
    correlation.sessionRef,
    correlationKey,
    recheckCount,
  ]);

  const result: ReplayState =
    state.correlationKey === correlationKey
      ? state.result
      : { status: "pending" };

  function recheck() {
    setState({ correlationKey, result: { status: "pending" } });
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
