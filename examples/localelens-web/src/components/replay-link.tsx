"use client";

import { Clock3, LoaderCircle, Play, RotateCcw, Unlink } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { CaptureCorrelation } from "@/src/features/capture/contracts";
import {
  LOCAL_REQUEST_HEADER,
  LOCAL_REQUEST_HEADER_VALUE,
} from "@/src/features/credential/protocol";
import type { ReplayEvent } from "@/src/features/replay/contracts";

const ReplayViewer = dynamic(
  () => import("@/src/components/replay-viewer").then((module) => module.ReplayViewer),
  { ssr: false },
);

type ReplayState =
  | { status: "pending" }
  | { status: "ready" }
  | { status: "unavailable" };

type SessionReplayState = {
  correlationKey: string;
  result: ReplayState;
};

type ViewerState =
  | { open: false }
  | { open: true; events: ReplayEvent[] | null; failed: boolean };

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function parseReplayStatus(status: number, body: unknown): ReplayState {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { status: "unavailable" };
  }

  const response = body as Record<string, unknown>;
  if (status === 202 && hasOnlyKeys(response, ["status"]) && response.status === "pending") {
    return { status: "pending" };
  }
  if (status === 200 && hasOnlyKeys(response, ["status"]) && response.status === "ready") {
    return { status: "ready" };
  }
  return { status: "unavailable" };
}

function parseReplayEvents(status: number, body: unknown): ReplayEvent[] | null {
  if (status !== 200 || typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const response = body as Record<string, unknown>;
  if (
    !hasOnlyKeys(response, ["status", "events"]) ||
    response.status !== "ready" ||
    !Array.isArray(response.events)
  ) {
    return null;
  }

  const valid = response.events.every((event) => {
    if (typeof event !== "object" || event === null || Array.isArray(event)) return false;
    const record = event as Record<string, unknown>;
    return (
      Number.isInteger(record.type) &&
      typeof record.timestamp === "number" &&
      Number.isFinite(record.timestamp) &&
      typeof record.data === "object" &&
      record.data !== null &&
      !Array.isArray(record.data)
    );
  });
  return valid ? (response.events as ReplayEvent[]) : null;
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
  const [checking, setChecking] = useState(true);
  const [viewer, setViewer] = useState<ViewerState>({ open: false });
  const lookedUpCorrelationRef = useRef<string | null>(null);
  const viewerControllerRef = useRef<AbortController | null>(null);
  const currentCorrelationRef = useRef(correlationKey);
  currentCorrelationRef.current = correlationKey;

  function replayPath(mode?: "events"): string {
    const query = new URLSearchParams({
      runId: correlation.runId,
      country: correlation.country,
      attempt: String(correlation.attempt),
    });
    if (mode) query.set("mode", mode);
    return `/api/replays/${correlation.sessionRef}?${query}`;
  }

  useEffect(() => {
    if (lookedUpCorrelationRef.current === correlationKey && recheckCount === 0) return;

    let controller: AbortController | undefined;
    const lookupTimer = window.setTimeout(() => {
      lookedUpCorrelationRef.current = correlationKey;
      const lookupController = new AbortController();
      controller = lookupController;
      setChecking(true);
      setState({ correlationKey, result: { status: "pending" } });

      void fetch(replayPath(), {
        headers: { [LOCAL_REQUEST_HEADER]: LOCAL_REQUEST_HEADER_VALUE },
        signal: lookupController.signal,
      })
        .then(async (response) => {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            return { status: "unavailable" } satisfies ReplayState;
          }
          return parseReplayStatus(response.status, body);
        })
        .then((nextState) => {
          if (!lookupController.signal.aborted) {
            setState({ correlationKey, result: nextState });
            setChecking(false);
          }
        })
        .catch(() => {
          if (!lookupController.signal.aborted) {
            setState({ correlationKey, result: { status: "unavailable" } });
            setChecking(false);
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

  useEffect(() => {
    viewerControllerRef.current?.abort();
    viewerControllerRef.current = null;
    setViewer({ open: false });
  }, [correlationKey]);

  useEffect(() => () => viewerControllerRef.current?.abort(), []);

  const result: ReplayState =
    state.correlationKey === correlationKey ? state.result : { status: "pending" };

  function recheck() {
    setChecking(true);
    setState({ correlationKey, result: { status: "pending" } });
    setRecheckCount((count) => count + 1);
  }

  function loadReplay() {
    viewerControllerRef.current?.abort();
    const controller = new AbortController();
    viewerControllerRef.current = controller;
    const requestedCorrelation = correlationKey;
    setViewer({ open: true, events: null, failed: false });

    void fetch(replayPath("events"), {
      headers: { [LOCAL_REQUEST_HEADER]: LOCAL_REQUEST_HEADER_VALUE },
      signal: controller.signal,
    })
      .then(async (response) => {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return null;
        }
        return parseReplayEvents(response.status, body);
      })
      .then((events) => {
        if (
          !controller.signal.aborted &&
          currentCorrelationRef.current === requestedCorrelation
        ) {
          setViewer({ open: true, events, failed: events === null });
        }
      })
      .catch(() => {
        if (
          !controller.signal.aborted &&
          currentCorrelationRef.current === requestedCorrelation
        ) {
          setViewer({ open: true, events: null, failed: true });
        }
      });
  }

  function closeViewer() {
    viewerControllerRef.current?.abort();
    viewerControllerRef.current = null;
    setViewer({ open: false });
  }

  return (
    <div className="replay-block">
      {result.status === "ready" ? (
        <>
          <button className="replay-link" onClick={loadReplay} type="button">
            <Play aria-hidden="true" size={16} />
            View page-load recording
          </button>
          <p className="replay-help">
            Review how the page rendered after its initial load.
          </p>
        </>
      ) : result.status === "pending" ? (
        <>
          <div className="replay-pending">
            <span className="replay-state">
              {checking ? (
                <LoaderCircle aria-hidden="true" className="status-spinner" size={16} />
              ) : (
                <Clock3 aria-hidden="true" size={16} />
              )}
              {checking ? "Checking recording" : "Recording pending"}
            </span>
            <button
              className="secondary-action"
              disabled={checking}
              onClick={recheck}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Check recording availability
            </button>
          </div>
          <p className="replay-help">
            Solari is preparing the page-load recording.
          </p>
        </>
      ) : (
        <>
          <span className="replay-state">
            <Unlink aria-hidden="true" size={16} />
            Recording unavailable
          </span>
          <p className="replay-help">
            No page-load recording is available for this capture.
          </p>
        </>
      )}

      {viewer.open ? (
        <ReplayViewer
          events={viewer.events}
          failed={viewer.failed}
          onClose={closeViewer}
          onRetry={loadReplay}
          sessionRef={correlation.sessionRef}
        />
      ) : null}
    </div>
  );
}
