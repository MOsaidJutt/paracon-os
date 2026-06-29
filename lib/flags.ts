/**
 * Boot-time feature flags (env-driven, OFF by default) — distinct from the
 * per-org Module toggles in lib/modules.ts. These hide whole platform-level
 * areas (Super Admin, AI) across every tenant for this delivery stage
 * without deleting the underlying pages.
 */
export function isAiFeatureEnabled(): boolean {
  return process.env.FEATURE_AI === "true";
}

export function isSuperAdminFeatureEnabled(): boolean {
  return process.env.FEATURE_SUPER_ADMIN === "true";
}
