import type { JsonValue, PlanDiagnostics } from "../lib/types";

interface DiagnosticsPanelProps {
  diagnostics: PlanDiagnostics | null;
  explanation: JsonValue | null;
}

export function DiagnosticsPanel({ diagnostics, explanation }: DiagnosticsPanelProps) {
  return (
    <section className="panel" aria-labelledby="diagnostics-heading">
      <div className="panel-heading">
        <h2 id="diagnostics-heading">Diagnostics</h2>
      </div>
      {diagnostics ? (
        <div className="diagnostics-grid">
          <Metric label="networkUsed" value={String(diagnostics.networkUsed)} />
          <Metric label="aliasMatches" value={String(diagnostics.aliasMatches.length)} />
          <Metric label="resolverQueries" value={String(diagnostics.resolverQueries.length)} />
          <Metric label="candidatesResolved" value={String(diagnostics.candidatesResolved)} />
        </div>
      ) : (
        <div className="empty-state">Generate a plan to view diagnostics.</div>
      )}
      {diagnostics?.networkUsed === false ? (
        <p className="notice-line">Offline planning mode: this plan has not queried fresh Modrinth metadata.</p>
      ) : null}
      {diagnostics && diagnostics.candidatesResolved === 0 ? (
        <p className="notice-line">Current plan may come from the mock/offline pipeline. A future resolver stage will verify live resource metadata.</p>
      ) : null}
      {diagnostics && diagnostics.warnings.length > 0 ? (
        <div className="message-list">
          <h3>Warnings</h3>
          <ul>
            {diagnostics.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {diagnostics && diagnostics.errors.length > 0 ? (
        <div className="message-list error-list">
          <h3>Errors</h3>
          <ul>
            {diagnostics.errors.map((error, index) => (
              <li key={`${error}-${index}`}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {explanation ? (
        <div className="explanation">
          <h3>Explanation</h3>
          <pre>{JSON.stringify(explanation, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
