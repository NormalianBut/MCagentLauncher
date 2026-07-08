export function SafetyNotice() {
  const items = [
    "Current stage is v0.1 alpha preview.",
    "Desktop Shell is dry-run only.",
    "AI does not execute files.",
    "MCAgent plans; Desktop may execute only in a future milestone.",
    "No resource download.",
    "No Minecraft, Fabric, Forge, or NeoForge install.",
    "No local instance write.",
    "No mods/resourcepacks/shaderpacks write.",
    "No Minecraft launch.",
    "User confirmation is required before any future executor can run.",
    "Confirm Install is preview-only in v0.1 alpha.",
    "Environment report is local-only and is not uploaded.",
    "M8.3 Safe Platform Probe only reads OS, arch, app version, and Tauri availability after consent.",
    "Java, path, disk, and network probes remain disabled.",
  ];

  return (
    <section className="panel safety-panel" aria-labelledby="safety-heading">
      <div className="panel-heading">
        <h2 id="safety-heading">Safety Notice</h2>
      </div>
      <ul className="check-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
