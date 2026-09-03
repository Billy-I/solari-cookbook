import type { AuditFormValue } from "@/src/components/audit-form";
import type { ComparisonRun } from "@/src/features/run/use-comparison-run";

type RunReceiptProps = {
  featured?: boolean;
  mode: ComparisonRun["mode"];
  status: ComparisonRun["status"];
  value: AuditFormValue;
};

export function RunReceipt({
  featured = false,
  mode,
  status,
  value,
}: RunReceiptProps) {
  return (
    <dl className="receipt-row">
      <div>
        <dt>Run receipt</dt>
        <dd>
          {featured
            ? "Featured sample"
            : mode === "sample"
              ? "Sample evidence"
              : "Live Solari capture"}
        </dd>
      </div>
      <div>
        <dt>Target host</dt>
        <dd>{new URL(value.url).host}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          {featured
            ? "Preview"
            : status === "idle"
              ? "Ready to compare"
              : status}
        </dd>
      </div>
      <div>
        <dt>Markets</dt>
        <dd>{value.countries.length} countries</dd>
      </div>
    </dl>
  );
}
