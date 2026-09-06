"use client";

import { AlertCircle, Download, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";

import type { ReplayEvent } from "@/src/features/replay/contracts";

type ReplayViewerProps = {
  events: ReplayEvent[] | null;
  failed: boolean;
  onClose: () => void;
  onRetry: () => void;
  sessionRef: string;
};

export function ReplayViewer({
  events,
  failed,
  onClose,
  onRetry,
  sessionRef,
}: ReplayViewerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const playerTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const target = playerTargetRef.current;
    if (!target || !events) return;

    const width = Math.max(320, Math.min(1_280, window.innerWidth - 96));
    const height = Math.max(260, Math.min(760, window.innerHeight - 260));
    const player = new rrwebPlayer({
      target,
      props: {
        autoPlay: false,
        events: events as never,
        height,
        maxScale: 1,
        showController: true,
        speedOption: [0.5, 1, 2, 4],
        width,
      },
    });

    return () =>
      (player as unknown as { $destroy: () => void }).$destroy();
  }, [events]);

  function downloadEvents() {
    if (!events) return;
    const contents = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
    const url = URL.createObjectURL(
      new Blob([contents], { type: "application/x-ndjson" }),
    );
    const link = document.createElement("a");
    link.download = `${sessionRef}.ndjson`;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="replay-overlay" role="presentation">
      <section
        aria-labelledby="replay-viewer-title"
        aria-modal="true"
        className="replay-viewer"
        role="dialog"
      >
        <header className="replay-viewer-header">
          <div>
            <p className="replay-viewer-kicker">Recorded page load</p>
            <h2 id="replay-viewer-title">Page-load recording</h2>
          </div>
          <button
            aria-label="Close page-load recording"
            className="replay-close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="replay-viewer-stage">
          {events ? (
            <>
              <p className="replay-ready-label">Recording ready</p>
              <div className="replay-player-target" ref={playerTargetRef} />
            </>
          ) : failed ? (
            <div className="replay-viewer-message" role="alert">
              <AlertCircle aria-hidden="true" size={22} />
              <h3>Recording could not be loaded</h3>
              <p>The recording was unavailable or did not pass validation.</p>
              <button className="secondary-action" onClick={onRetry} type="button">
                <RotateCcw aria-hidden="true" size={16} />
                Try loading recording again
              </button>
            </div>
          ) : (
            <div className="replay-viewer-message" role="status">
              <LoaderCircle aria-hidden="true" className="status-spinner" size={22} />
              <h3>Loading page-load recording</h3>
              <p>Retrieving the bounded recording for this page load.</p>
            </div>
          )}
        </div>

        {events ? (
          <details className="replay-developer-data">
            <summary>Developer data</summary>
            <p>Download the validated event stream as plain NDJSON.</p>
            <button className="secondary-action" onClick={downloadEvents} type="button">
              <Download aria-hidden="true" size={16} />
              Download NDJSON
            </button>
          </details>
        ) : null}
      </section>
    </div>
  );
}
