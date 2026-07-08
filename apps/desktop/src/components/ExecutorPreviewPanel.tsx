import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface ExecutorPreviewPanelProps {
  preview: JsonValue | null;
}

export function ExecutorPreviewPanel({ preview }: ExecutorPreviewPanelProps) {
  return (
    <section className="panel" aria-labelledby="executor-preview-heading">
      <div className="panel-heading">
        <h2 id="executor-preview-heading">Executor Dry-run Preview</h2>
        <span className="status-pill blocked">canExecute=false</span>
      </div>
      <p className="notice-line">不会下载、不会安装、不会写本地实例，也不会启动 Minecraft。</p>
      <JsonBlock value={preview} emptyLabel="Generate install preview to inspect executor dry-run output." />
    </section>
  );
}
