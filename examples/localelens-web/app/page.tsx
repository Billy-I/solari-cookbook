"use client";

import { Download, Printer } from "lucide-react";

import {
  AuditForm,
  type AuditFormValue,
} from "@/src/components/audit-form";
import { ComparisonResults } from "@/src/components/comparison-results";
import { RunReceipt } from "@/src/components/run-receipt";
import { RunStatus } from "@/src/components/run-status";
import {
  useComparisonRun,
  type RegionRunState,
} from "@/src/features/run/use-comparison-run";
import { sampleCaptureByCountry } from "@/src/test/fixtures";

const featuredCountries = ["us", "gb", "de"] as const;

const featuredValue: AuditFormValue = {
  url: "https://regional.example.test/pricing",
  countries: [...featuredCountries],
};

const featuredRegions: RegionRunState[] = featuredCountries.map(
  (country) => ({
    country,
    stage: "complete",
    response: sampleCaptureByCountry[country],
  }),
);

export default function Page() {
  const run = useComparisonRun();

  const statusRegions = run.regions.length > 0 ? run.regions : featuredRegions;
  const evidenceRegions = run.regions.length > 0 ? run.regions : featuredRegions;
  const evidenceMode = run.value === null ? "sample" : run.mode;
  const hasPendingRegion = run.regions.some(
    ({ stage }) => stage !== "complete" && stage !== "failed",
  );

  function startComparison(value: AuditFormValue) {
    void run.start(value);
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
            {run.mode === "sample"
              ? "Compare deterministic sample evidence from one public page across selected markets."
              : "Compare live Solari capture evidence from one public page across selected markets."}
          </p>
        </details>
      </header>

      <main>
        <section aria-label="Run comparison" className="run-control">
          <div className="section-heading">
            <p className="eyebrow">Run comparison</p>
            <h1>Compare the experience by market</h1>
          </div>

          <AuditForm
            busy={hasPendingRegion}
            onSubmit={startComparison}
          />
        </section>

        <section aria-label="Run evidence" className="run-evidence">
          <RunReceipt
            mode={evidenceMode}
            status={run.status}
            value={run.value ?? featuredValue}
          />
          <RunStatus regions={statusRegions} />
        </section>

        <ComparisonResults
          onRetry={(country) => void run.retry(country)}
          regions={evidenceRegions}
        />

        <section
          aria-labelledby="evidence-actions-heading"
          className="evidence-actions"
        >
          <div>
            <p className="eyebrow">Evidence actions</p>
            <h2 id="evidence-actions-heading">Keep the sample reviewable</h2>
          </div>
          <div className="future-actions">
            <button aria-describedby="future-export-note" disabled type="button">
              <Download aria-hidden="true" size={17} />
              Download JSON
            </button>
            <button aria-describedby="future-export-note" disabled type="button">
              <Printer aria-hidden="true" size={17} />
              Print evidence
            </button>
            <p id="future-export-note">Available after Phase 3</p>
          </div>
        </section>
      </main>

      <footer className="limitations">
        <span>Public pages only</span>
        <span>
          {run.mode === "sample"
            ? "Sample evidence captured 1 Sep 2026"
            : "Live Solari capture is owner-controlled"}
        </span>
        <span>Replay availability is temporary.</span>
        <span>Not a compliance verdict</span>
      </footer>
    </div>
  );
}
