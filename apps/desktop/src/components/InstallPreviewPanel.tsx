import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface InstallPreviewPanelProps {
  preview: JsonValue | null;
}

export function InstallPreviewPanel({ preview }: InstallPreviewPanelProps) {
  const summary = summarizeInstallPreview(preview);

  return (
    <section className="panel wide" aria-labelledby="install-preview-heading">
      <div className="panel-heading">
        <h2 id="install-preview-heading">Install Preview Review</h2>
        <span className="status-pill safe">dryRun=true</span>
        <span className="status-pill safe">requiresUserConfirmation=true</span>
        <span className="status-pill blocked">canExecute=false</span>
      </div>
      <p className="notice-line">
        These actions are not executed. They are only an audit checklist for a future Desktop Local Executor confirmation flow.
      </p>
      {summary ? (
        <>
          <div className="summary-grid">
            <Metric label="Actions" value={summary.actionCount} />
            <Metric label="Resources" value={summary.resourceCount} />
            <Metric label="dryRun" value={summary.dryRun} />
            <Metric label="User confirmation" value={summary.requiresUserConfirmation} />
            <Metric label="Warnings" value={summary.warningCount} />
            <Metric label="Blocked" value={summary.blockedCount} />
          </div>
          <div className="action-review-list">
            {summary.groups.map((group) => (
              <div className="action-group" key={group.label}>
                <h3>{group.label}</h3>
                {group.actions.length > 0 ? (
                  <ul>
                    {group.actions.map((action) => (
                      <li key={action.actionId}>
                        <strong>{action.title}</strong>
                        <span>{action.type} / {action.riskLevel} / {action.status}</span>
                        <span>{action.target} {action.resourceRef ? `/ ${action.resourceRef}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-line">No action in this group.</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}
      <JsonBlock value={preview} emptyLabel="Generate install preview to inspect dry-run install actions." />
    </section>
  );
}

function summarizeInstallPreview(value: JsonValue | null) {
  if (!isRecord(value) || !Array.isArray(value.actions)) {
    return null;
  }
  const actions = value.actions.filter(isRecord);
  const diagnostics = isRecord(value.diagnostics) ? value.diagnostics : null;
  const warningCount = Array.isArray(diagnostics?.warnings) ? diagnostics.warnings.length : 0;
  const groups = [
    { label: "Instance", types: ["create_instance"] },
    { label: "Minecraft / Loader", types: ["install_minecraft", "install_loader"] },
    { label: "Resources", types: ["add_resource"] },
    { label: "Config", types: ["write_config"] },
    { label: "Snapshot", types: ["create_snapshot"] },
    { label: "Launch Preview", types: ["launch_instance"] },
  ].map((group) => ({
    label: group.label,
    actions: actions
      .filter((action) => typeof action.type === "string" && group.types.includes(action.type))
      .map(readAction),
  }));

  return {
    actionCount: String(actions.length),
    resourceCount: String(actions.filter((action) => action.type === "add_resource").length),
    dryRun: String(value.dryRun === true),
    requiresUserConfirmation: String(value.requiresUserConfirmation === true),
    warningCount: String(warningCount),
    blockedCount: String(actions.filter((action) => action.status === "blocked").length),
    groups,
  };
}

function readAction(action: Record<string, JsonValue>) {
  const target = isRecord(action.target) ? action.target : null;
  const resourceRef = isRecord(action.resourceRef) ? action.resourceRef : null;
  return {
    actionId: readString(action.actionId) ?? "action",
    title: readString(action.title) ?? "Untitled action",
    type: readString(action.type) ?? "unknown",
    riskLevel: readString(action.riskLevel) ?? "unknown",
    status: readString(action.status) ?? "unknown",
    target: target ? `${readString(target.destination) ?? "target"}:${readString(target.minecraftVersion) ?? "unknown"}` : "unknown target",
    resourceRef: resourceRef ? readString(resourceRef.name) ?? readString(resourceRef.resourceId) : null,
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

function readString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: JsonValue | undefined | null): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
