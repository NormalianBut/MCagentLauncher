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
          This M8.3 probe reads only low-risk platform metadata after consent: OS family, architecture hint, app version, and Tauri runtime availability.
        </p>
        <ul className="check-list">
          <li>Read-only safe platform metadata only.</li>
          <li>No Java detection.</li>
          <li>No Minecraft path lookup.</li>
          <li>No disk scan.</li>
          <li>No network request.</li>
          <li>No resource download.</li>
          <li>No install action.</li>
          <li>No file write.</li>
          <li>No Minecraft launch.</li>
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
