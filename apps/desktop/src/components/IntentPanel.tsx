import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface IntentPanelProps {
  intent: JsonValue | null;
}

export function IntentPanel({ intent }: IntentPanelProps) {
  const summary = summarizeIntent(intent);

  return (
    <section className="panel" aria-labelledby="intent-heading">
      <div className="panel-heading">
        <h2 id="intent-heading">Intent Summary</h2>
      </div>
      {summary ? (
        <div className="summary-grid compact">
          <Metric label="Minecraft" value={summary.minecraftVersion} />
          <Metric label="Loader" value={summary.loader} />
          <Metric label="Risk" value={summary.riskPreference} />
          <Metric label="Goals" value={summary.goals} />
          <Metric label="Must include" value={summary.mustInclude} />
          <Metric label="Avoid" value={summary.avoid} />
        </div>
      ) : null}
      <JsonBlock value={intent} emptyLabel="Parse intent to inspect structured player requirements." />
    </section>
  );
}

function summarizeIntent(value: JsonValue | null) {
  if (!isRecord(value)) {
    return null;
  }

  return {
    minecraftVersion: readString(value.minecraftVersion) ?? readNestedString(value, ["target", "minecraftVersion"]) ?? "unknown",
    loader: readString(value.loader) ?? readNestedString(value, ["target", "loader"]) ?? "unknown",
    goals: readList(value.goals),
    mustInclude: readList(value.mustInclude ?? value.must_include ?? value.requestedFeatures),
    avoid: readList(value.avoid ?? value.avoidFeatures),
    riskPreference: readString(value.riskPreference ?? value.risk_preference) ?? "stable",
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function readList(value: JsonValue | undefined): string {
  if (!Array.isArray(value) || value.length === 0) {
    return "none";
  }
  return value.map((item) => String(item)).join(", ");
}

function readNestedString(value: Record<string, JsonValue>, path: string[]): string | null {
  let current: JsonValue | undefined = value;
  for (const part of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[part];
  }
  return readString(current);
}

function readString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: JsonValue | undefined | null): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
