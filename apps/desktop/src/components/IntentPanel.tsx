import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface IntentPanelProps {
  intent: JsonValue | null;
}

export function IntentPanel({ intent }: IntentPanelProps) {
  return (
    <section className="panel" aria-labelledby="intent-heading">
      <div className="panel-heading">
        <h2 id="intent-heading">Intent JSON</h2>
      </div>
      <JsonBlock value={intent} emptyLabel="Parse intent to inspect structured player requirements." />
    </section>
  );
}
