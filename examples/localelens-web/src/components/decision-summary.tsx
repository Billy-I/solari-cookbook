import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
} from "lucide-react";

import type { DecisionSignal } from "@/src/features/compare/summarize-comparison";

const stateLabels: Record<DecisionSignal["state"], string> = {
  consistent: "Consistent",
  attention: "Needs attention",
  unavailable: "Not enough evidence",
};

type DecisionSummaryProps = {
  signals: DecisionSignal[];
};

export function DecisionSummary({ signals }: DecisionSummaryProps) {
  return (
    <section aria-labelledby="decision-summary-heading" className="decision-summary">
      <div className="decision-heading">
        <h2 id="decision-summary-heading">What changed</h2>
        <p>Decision signals grounded only in captured fields.</p>
      </div>
      <ul aria-label="Decision signals" className="decision-signals">
        {signals.map((signal) => {
          const Icon =
            signal.state === "consistent"
              ? CircleCheck
              : signal.state === "attention"
                ? CircleAlert
                : CircleMinus;

          return (
            <li className={`decision-${signal.state}`} key={signal.category}>
              <div className="decision-signal-heading">
                <h3>{signal.title}</h3>
                <span>
                  <Icon aria-hidden="true" size={16} />
                  {stateLabels[signal.state]}
                </span>
              </div>
              <p>{signal.detail}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
