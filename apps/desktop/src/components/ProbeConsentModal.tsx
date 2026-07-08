interface ProbeConsentModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ProbeConsentModal({ onCancel, onConfirm }: ProbeConsentModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="probe-consent-heading">
        <h2 id="probe-consent-heading">Run Read-only Probe?</h2>
        <p>
          This M8.1 flow only generates a consented read-only preview report. It does not run system commands or inspect real local paths.
        </p>
        <ul className="check-list">
          <li>Read-only preview only.</li>
          <li>No resource download.</li>
          <li>No install action.</li>
          <li>No file write.</li>
          <li>No Minecraft launch.</li>
          <li>No sensitive directory scan.</li>
          <li>No report upload.</li>
          <li>Result is displayed only in the current Desktop session.</li>
        </ul>
        <div className="button-row modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}>
            Confirm Read-only Probe
          </button>
        </div>
      </section>
    </div>
  );
}
