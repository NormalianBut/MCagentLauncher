import type { BuildInfo } from "../../../../packages/shared-types/src/buildInfo";

export function BuildInfoPanel({ info }: { info: BuildInfo }) {
  return (
    <section className="panel wide build-info-panel">
      <div className="panel-heading">
        <h2>Native Desktop Preview</h2>
        <span className="status-pill blocked">Unsigned preview build</span>
      </div>
      <div className="summary-grid compact">
        <div className="summary-card"><span className="metric-label">Application</span><strong>{info.appName} {info.appVersion}</strong></div>
        <div className="summary-card"><span className="metric-label">Runtime</span><strong>{info.packaged ? "Packaged Tauri" : "Source preview"}</strong></div>
        <div className="summary-card"><span className="metric-label">MCAgent Server</span><strong>Not bundled</strong></div>
        <div className="summary-card"><span className="metric-label">Local Executor / Updater</span><strong>Disabled / Disabled</strong></div>
      </div>
      <p className="build-boundary">No resource download, Minecraft install, local instance write, or Minecraft launch is enabled.</p>
      <details className="raw-json-panel">
        <summary>Raw BuildInfo</summary>
        <pre className="json-block">{JSON.stringify(info, null, 2)}</pre>
      </details>
    </section>
  );
}
