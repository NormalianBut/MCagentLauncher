interface PromptInputProps {
  text: string;
  pending: string | null;
  canGeneratePlan: boolean;
  canExplainPlan: boolean;
  canGeneratePreview: boolean;
  canConfirmPreview: boolean;
  onTextChange: (value: string) => void;
  onParseIntent: () => void;
  onGeneratePlan: () => void;
  onExplainPlan: () => void;
  onGeneratePreview: () => void;
  onConfirmInstall: () => void;
  onGenerateEnvironmentPreview: () => void;
  onRunSafePlatformProbe: () => void;
}

export function PromptInput({
  text,
  pending,
  canGeneratePlan,
  canExplainPlan,
  canGeneratePreview,
  canConfirmPreview,
  onTextChange,
  onParseIntent,
  onGeneratePlan,
  onExplainPlan,
  onGeneratePreview,
  onConfirmInstall,
  onGenerateEnvironmentPreview,
  onRunSafePlatformProbe,
}: PromptInputProps) {
  return (
    <section className="panel prompt-panel" aria-labelledby="prompt-heading">
      <div className="panel-heading">
        <h2 id="prompt-heading">Prompt</h2>
        <span className="status-pill">Offline by default</span>
      </div>
      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        rows={5}
        aria-label="Natural language Minecraft instance request"
      />
      <div className="button-row">
        <button type="button" onClick={onParseIntent} disabled={pending !== null || text.trim().length === 0}>
          Parse Intent
        </button>
        <button type="button" onClick={onGeneratePlan} disabled={pending !== null || !canGeneratePlan}>
          Generate Plan
        </button>
        <button type="button" onClick={onExplainPlan} disabled={pending !== null || !canExplainPlan}>
          Explain Plan
        </button>
        <button type="button" onClick={onGeneratePreview} disabled={pending !== null || !canGeneratePreview}>
          Generate Install Preview
        </button>
        <button type="button" className="secondary" onClick={onConfirmInstall} disabled={pending !== null || !canConfirmPreview}>
          Confirm Install (preview-only)
        </button>
        <button type="button" onClick={onGenerateEnvironmentPreview} disabled={pending !== null}>
          Generate Environment Preview
        </button>
        <button type="button" onClick={onRunSafePlatformProbe} disabled={pending !== null}>
          Run Safe Platform Probe
        </button>
      </div>
      {pending ? <div className="pending-line">{pending}</div> : null}
    </section>
  );
}
