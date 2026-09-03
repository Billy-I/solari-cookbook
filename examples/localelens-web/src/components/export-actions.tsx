"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";

import {
  canExportReport,
  createJsonReport,
} from "@/src/features/export/create-json-report";
import type { AppRunId } from "@/src/features/capture/contracts";
import type {
  ComparisonRun,
  RegionRunState,
} from "@/src/features/run/use-comparison-run";

type ExportActionsProps = {
  regions: RegionRunState[];
  runId: AppRunId | null;
  status: ComparisonRun["status"];
  target: string;
};

export function ExportActions({
  regions,
  runId,
  status,
  target,
}: ExportActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const successfulCount = regions.filter(({ response }) => response?.ok).length;
  const enabled = runId !== null && canExportReport(regions);
  const complete = enabled && successfulCount === regions.length && status === "complete";

  function downloadJson() {
    if (!runId) return;

    try {
      const report = createJsonReport({
        generatedAt: new Date().toISOString(),
        regions,
        runId,
        status,
        target,
      });
      const objectUrl = URL.createObjectURL(
        new Blob([report.json], { type: "application/json;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.download = report.filename;
      anchor.href = objectUrl;
      document.body.append(anchor);

      try {
        anchor.click();
      } finally {
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The report could not be exported safely.",
      );
    }
  }

  return (
    <div className="export-actions">
      <button
        aria-describedby="export-note"
        disabled={!enabled}
        onClick={downloadJson}
        type="button"
      >
        <Download aria-hidden="true" size={17} />
        Download JSON
      </button>
      <button
        aria-describedby="export-note"
        disabled={!enabled}
        onClick={() => window.print()}
        type="button"
      >
        <Printer aria-hidden="true" size={17} />
        Print evidence
      </button>
      <p id="export-note">
        {!runId
          ? "Run a live comparison to create an exportable receipt."
          : !enabled
            ? "Available after 2 regional captures succeed."
            : complete
              ? `Complete report: ${successfulCount} captures succeeded.`
              : `Partial report: ${successfulCount} of ${regions.length} captures succeeded.`}
      </p>
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
    </div>
  );
}
