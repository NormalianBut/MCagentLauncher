export function SafetyNotice() {
  const items = [
    "Current stage is M7 Desktop Shell.",
    "Only dry-run preview is supported.",
    "AI does not execute files.",
    "Web/Desktop shell does not write files.",
    "Install actions are dry-run.",
    "User confirmation is required.",
    "Local executor is disabled.",
    "No Minecraft or resource files are downloaded.",
    "Fabric, Forge, and NeoForge are not installed.",
    "mods/resourcepacks/shaderpacks are not written.",
    "Minecraft is not launched.",
    "Confirm Install is preview-only.",
    "Environment Preview is mock data and is not uploaded.",
    "No real Java check, disk scan, or Minecraft path read is performed.",
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
