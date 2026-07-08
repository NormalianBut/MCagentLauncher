import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface EnvironmentPanelProps {
  report: JsonValue | null;
  summary: string | null;
  readinessLevel: string | null;
  warnings: Array<{ code: string; message: string }>;
  blockers: Array<{ code: string; message: string }>;
  onGeneratePreview: () => void;
  onRunReadOnlyProbe: () => void;
}

export function EnvironmentPanel({
  report,
  summary,
  readinessLevel,
  warnings,
  blockers,
  onGeneratePreview,
  onRunReadOnlyProbe,
}: EnvironmentPanelProps) {
  return (
    <section className="panel wide environment-panel" aria-labelledby="environment-heading">
      <div className="panel-heading">
        <h2 id="environment-heading">Environment Preview</h2>
        <span className="status-pill safe">localOnly=true</span>
        <span className="status-pill blocked">uploadAllowed=false</span>
      </div>
      <div className="button-row">
        <button type="button" onClick={onGeneratePreview}>
          Generate Environment Preview
        </button>
        <button type="button" className="secondary" onClick={onRunReadOnlyProbe}>
          Run Read-only Probe
        </button>
      </div>
      <p className="notice-line">
        Mock/read-only preview only. Run Read-only Probe requires explicit consent first. No real Minecraft directory is read, no Java command is run, no disk scan is performed, no environment report is uploaded, and no process is launched.
      </p>
      {summary ? <p className="summary-line">{summary}</p> : null}
      {readinessLevel ? (
        <div className="readiness-line">
          <span className="metric-label">readiness</span>
          <strong>{readinessLevel}</strong>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="message-list">
          <h3>Warnings</h3>
          <ul>
            {warnings.map((warning) => (
              <li key={warning.code}>
                <strong>{warning.code}</strong>: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {blockers.length > 0 ? (
        <div className="message-list error-list">
          <h3>Blockers</h3>
          <ul>
            {blockers.map((blocker) => (
              <li key={blocker.code}>
                <strong>{blocker.code}</strong>: {blocker.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <JsonBlock value={report} emptyLabel="Generate environment preview to inspect the mock local environment report." />
    </section>
  );
}
