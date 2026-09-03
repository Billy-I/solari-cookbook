import type { AuditFormValue } from "@/src/components/audit-form";
import type { AppRunId } from "@/src/features/capture/contracts";
import type { ComparisonRun } from "@/src/features/run/use-comparison-run";

type RunReceiptProps = {
  runId: AppRunId | null;
  status: ComparisonRun["status"];
  value: AuditFormValue;
};

export function RunReceipt({
  runId,
  status,
  value,
}: RunReceiptProps) {
  return (
    <dl className={`receipt-row${runId ? " receipt-row-with-id" : ""}`}>
      <div>
        <dt>Run receipt</dt>
        <dd>
          Live Solari capture
        </dd>
      </div>
      <div>
        <dt>Target host</dt>
        <dd>{new URL(value.url).host}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          {status === "idle" ? "Ready to compare" : status}
        </dd>
      </div>
      <div>
        <dt>Markets</dt>
        <dd>{value.countries.length} countries</dd>
      </div>
      {runId ? (
        <div className="run-identity">
          <dt>Run ID</dt>
          <dd>{runId}</dd>
        </div>
      ) : null}
    </dl>
  );
}
