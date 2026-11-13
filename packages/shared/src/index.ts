/**
 * Types and helpers shared by the checker CLI and the platform.
 * canonical.ts and result-schema.ts are pure and exported here.
 * signing.ts uses node:crypto, so it is imported by its own path
 * ("@gpis-academy/shared/signing") and only from server or CLI code.
 */
export * from "./content-schema.ts";
export * from "./canonical.ts";
export * from "./result-schema.ts";
