import type { AuditFormValue } from "@/src/components/audit-form";
import type { SampleRunController } from "@/src/features/run/use-sample-run";

type RunReceiptProps = {
  status: SampleRunController["status"];
  value: AuditFormValue;
};

export function RunReceipt({ status, value }: RunReceiptProps) {
  return (
    <dl className="receipt-row">
      <div>
        <dt>Run receipt</dt>
        <dd>{status === "idle" ? "Featured sample" : "Sample mode"}</dd>
      </div>
      <div>
        <dt>Target host</dt>
        <dd>{new URL(value.url).host}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{status === "idle" ? "Ready to compare" : status}</dd>
      </div>
      <div>
        <dt>Markets</dt>
        <dd>{value.countries.length} countries</dd>
      </div>
    </dl>
  );
}
