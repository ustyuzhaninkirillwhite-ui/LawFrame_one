export const dataClassification = [
  "public",
  "internal",
  "confidential",
  "legal_secret",
  "personal_data",
  "client_material",
  "ai_forbidden_external",
  "anonymized",
] as const;

export type DataClassification = (typeof dataClassification)[number];
