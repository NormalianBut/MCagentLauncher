import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface ExecutorPreviewPanelProps {
  preview: JsonValue | null;
}

export function ExecutorPreviewPanel({ preview }: ExecutorPreviewPanelProps) {
  const summary = summarizeExecutor(preview);

  return (
    <section className="panel" aria-labelledby="executor-preview-heading">
      <div className="panel-heading">
        <h2 id="executor-preview-heading">Executor Dry-run Preview</h2>
        <span className="status-pill blocked">canExecute=false</span>
      </div>
      <p className="notice-line">No download, no install, no local instance write, and no Minecraft launch. This panel only previews executor decisions.</p>
      {summary ? (
        <div className="summary-grid compact">
          <Metric label="Actions" value={summary.actionCount} />
          <Metric label="Blocked" value={summary.blockedCount} />
          <Metric label="dryRun" value={summary.dryRun} />
          <Metric label="User confirmation" value={summary.requiresUserConfirmation} />
          <Metric label="Warnings" value={summary.warningCount} />
          <Metric label="Errors" value={summary.errorCount} />
        </div>
      ) : null}
      {summary?.summary ? <p className="summary-line">{summary.summary}</p> : null}
      <JsonBlock value={preview} emptyLabel="Generate install preview to inspect executor dry-run output." />
    </section>
  );
}

function summarizeExecutor(value: JsonValue | null) {
  if (!isRecord(value)) {
    return null;
  }
  return {
    actionCount: String(Array.isArray(value.actions) ? value.actions.length : 0),
    blockedCount: String(Array.isArray(value.blockedActions) ? value.blockedActions.length : 0),
    dryRun: String(value.dryRun === true),
    requiresUserConfirmation: String(value.requiresUserConfirmation === true),
    warningCount: String(Array.isArray(value.warnings) ? value.warnings.length : 0),
    errorCount: String(Array.isArray(value.errors) ? value.errors.length : 0),
    summary: typeof value.summary === "string" ? value.summary : null,
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

function isRecord(value: JsonValue | undefined | null): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
