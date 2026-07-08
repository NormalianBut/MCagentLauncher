import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface PlanPanelProps {
  planResponse: JsonValue | null;
}

export function PlanPanel({ planResponse }: PlanPanelProps) {
  const summary = summarizePlan(planResponse);

  return (
    <section className="panel wide" aria-labelledby="plan-heading">
      <div className="panel-heading">
        <h2 id="plan-heading">Resource Plan Summary</h2>
        {summary ? <span className="status-pill safe">networkUsed={summary.networkUsed}</span> : null}
      </div>
      {summary ? (
        <div className="summary-grid">
          <Metric label="Plan" value={summary.title} />
          <Metric label="Minecraft" value={summary.minecraftVersion} />
          <Metric label="Loader" value={summary.loader} />
          <Metric label="Resources" value={summary.resourceCount} />
          <Metric label="Required" value={summary.requiredCount} />
          <Metric label="Warnings" value={summary.warningCount} />
          <Metric label="Errors" value={summary.errorCount} />
          <Metric label="Status" value={summary.status} />
        </div>
      ) : null}
      <JsonBlock value={planResponse} emptyLabel="Generate a plan to inspect the resource-plan wrapper response." />
    </section>
  );
}

function summarizePlan(value: JsonValue | null) {
  const plan = extractPlan(value);
  if (!plan) {
    return null;
  }
  const diagnostics = isRecord(value) && isRecord(value.diagnostics) ? value.diagnostics : null;
  const resources = Array.isArray(plan.resources) ? plan.resources.filter(isRecord) : [];
  const ruleResults = isRecord(plan.ruleResults) ? plan.ruleResults : null;
  const warnings = [
    ...(Array.isArray(ruleResults?.warnings) ? ruleResults.warnings : []),
    ...(diagnostics && Array.isArray(diagnostics.warnings) ? diagnostics.warnings : []),
  ];
  const errors = [
    ...(Array.isArray(ruleResults?.errors) ? ruleResults.errors : []),
    ...(diagnostics && Array.isArray(diagnostics.errors) ? diagnostics.errors : []),
  ];

  return {
    title: readNestedString(plan, ["summary", "title"]) ?? readString(plan.planId) ?? "resource plan",
    minecraftVersion: readNestedString(plan, ["target", "minecraftVersion"]) ?? "unknown",
    loader: readNestedString(plan, ["target", "loader"]) ?? "unknown",
    resourceCount: String(resources.length),
    requiredCount: String(resources.filter((resource) => resource.required === true).length),
    warningCount: String(warnings.length),
    errorCount: String(errors.length),
    status: readString(plan.status) ?? "unknown",
    networkUsed: diagnostics?.networkUsed === true ? "true" : "false",
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

function extractPlan(value: JsonValue | null): Record<string, JsonValue> | null {
  if (!isRecord(value)) {
    return null;
  }
  if (isRecord(value.plan)) {
    return value.plan;
  }
  if (Array.isArray(value.resources)) {
    return value;
  }
  return null;
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
