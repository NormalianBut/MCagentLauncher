export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface PlanOptions {
  mode?: "mock" | "pipeline";
  enableNetwork?: boolean;
}

export interface PlanDiagnostics {
  aliasMatches: JsonValue[];
  resolverQueries: JsonValue[];
  candidatesResolved: number;
  warnings: string[];
  errors: string[];
  networkUsed: boolean;
}

export interface PlanResponse {
  schemaVersion?: string;
  schema_version?: string;
  plan: JsonValue;
  diagnostics: PlanDiagnostics;
}
