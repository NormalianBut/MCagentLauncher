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
          <div>
            <span className="metric-label">networkUsed</span>
            <strong>{String(diagnostics.networkUsed)}</strong>
          </div>
          <div>
            <span className="metric-label">aliasMatches</span>
            <strong>{diagnostics.aliasMatches.length}</strong>
          </div>
          <div>
            <span className="metric-label">resolverQueries</span>
            <strong>{diagnostics.resolverQueries.length}</strong>
          </div>
          <div>
            <span className="metric-label">candidatesResolved</span>
            <strong>{diagnostics.candidatesResolved}</strong>
          </div>
        </div>
      ) : (
        <div className="empty-state">Generate a plan to view diagnostics.</div>
      )}
      {diagnostics?.networkUsed === false ? (
        <p className="notice-line">当前为离线规划模式，没有联网查询真实资源元数据。</p>
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
