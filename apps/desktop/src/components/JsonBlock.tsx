import type { JsonValue } from "../lib/types";

interface JsonBlockProps {
  value: JsonValue | null;
  emptyLabel: string;
}

export function JsonBlock({ value, emptyLabel }: JsonBlockProps) {
  if (value === null) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <details className="raw-json-panel">
      <summary>Raw JSON</summary>
      <pre className="json-block">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
