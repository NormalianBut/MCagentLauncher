import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface InstallPreviewPanelProps {
  preview: JsonValue | null;
}

export function InstallPreviewPanel({ preview }: InstallPreviewPanelProps) {
  return (
    <section className="panel wide" aria-labelledby="install-preview-heading">
      <div className="panel-heading">
        <h2 id="install-preview-heading">Install Actions Preview</h2>
        <span className="status-pill safe">dryRun=true</span>
        <span className="status-pill safe">requiresUserConfirmation=true</span>
      </div>
      <JsonBlock value={preview} emptyLabel="Generate install preview to inspect dry-run install actions." />
    </section>
  );
}
