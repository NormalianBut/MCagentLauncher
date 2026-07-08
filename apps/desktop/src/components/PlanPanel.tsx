import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface PlanPanelProps {
  planResponse: JsonValue | null;
}

export function PlanPanel({ planResponse }: PlanPanelProps) {
  return (
    <section className="panel wide" aria-labelledby="plan-heading">
      <div className="panel-heading">
        <h2 id="plan-heading">Resource Plan Response</h2>
      </div>
      <JsonBlock value={planResponse} emptyLabel="Generate a plan to inspect the resource-plan wrapper response." />
    </section>
  );
}
