"use client";

import { useEffect, useRef } from "react";

import {
  AuditForm,
  type AuditFormValue,
} from "@/src/components/audit-form";
import { ComparisonResults } from "@/src/components/comparison-results";
import { ExportActions } from "@/src/components/export-actions";
import { RunReceipt } from "@/src/components/run-receipt";
import { RunStatus } from "@/src/components/run-status";
import { SolariConnection } from "@/src/components/solari-connection";
import { useSolariConnection } from "@/src/features/credential/use-solari-connection";
import { useComparisonRun } from "@/src/features/run/use-comparison-run";

export default function Page() {
  const connection = useSolariConnection();
  const run = useComparisonRun();
  const { markAuthenticationFailed } = connection;
  const invalidatedRunRef = useRef<string | null>(null);
  const hasPendingRegion = run.regions.some(
    ({ stage }) =>
      stage === "queued" ||
      stage === "launching" ||
      stage === "navigating" ||
      stage === "extracting" ||
      stage === "closing",
  );

  useEffect(() => {
    const authenticationFailed = run.regions.some(
      ({ response }) =>
        response !== null &&
        !response.ok &&
        response.error.code === "SOLARI_AUTH",
    );
    if (
      authenticationFailed &&
      run.runId !== null &&
      invalidatedRunRef.current !== run.runId
    ) {
      invalidatedRunRef.current = run.runId;
      markAuthenticationFailed();
    }
  }, [markAuthenticationFailed, run.regions, run.runId]);

  function startComparison(value: AuditFormValue) {
    void run.start(value);
  }

  function focusConnection() {
    document.getElementById("solari-api-key")?.focus();
  }

  return (
    <div className="app-shell">
      <header className="product-header">
        <div className="product-lockup">
          <p className="product-name">LocaleLens</p>
          <p>See what customers in each market actually see.</p>
        </div>
        <details className="how-it-works">
          <summary>How it works</summary>
          <p>
            Compare live Solari capture evidence from one public page across
            selected markets.
          </p>
        </details>
      </header>

      <main>
        <section aria-label="Run comparison" className="run-control">
          <div className="section-heading">
            <h1>Compare the experience by market</h1>
          </div>

          <SolariConnection connection={connection} />
          <AuditForm
            busy={hasPendingRegion}
            connectionReady={connection.ready}
            onNeedsConnection={focusConnection}
            onSubmit={startComparison}
          />
        </section>

        {run.value ? (
          <>
            <section aria-label="Run evidence" className="run-evidence">
              <RunReceipt
                runId={run.runId}
                status={run.status}
                value={run.value}
              />
              <RunStatus progress={run.progress} regions={run.regions} />
              {hasPendingRegion ? (
                <div className="run-cancel-row">
                  <button
                    className="secondary-action"
                    onClick={run.cancel}
                    type="button"
                  >
                    Cancel comparison
                  </button>
                </div>
              ) : null}
            </section>

            <ComparisonResults
              onRetry={(country) => void run.retry(country)}
              regions={run.regions}
            />

            <section
              aria-labelledby="evidence-actions-heading"
              className="evidence-actions"
            >
              <div>
                <h2 id="evidence-actions-heading">Keep the evidence reviewable</h2>
              </div>
              <ExportActions
                regions={run.regions}
                runId={run.runId}
                status={run.status}
                target={run.value.url}
              />
            </section>
          </>
        ) : null}
      </main>

      <footer className="limitations">
        <span>Public pages only</span>
        <span>Live Solari capture is owner-controlled</span>
        <span>Replay availability is temporary.</span>
        <span>Not a compliance verdict</span>
      </footer>
    </div>
  );
}
