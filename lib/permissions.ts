export const PERMISSION_GROUPS = {
  prospect: ["prospect.view", "prospect.edit"],
  tender: ["tender.view", "tender.edit"],
  project: ["project.view", "project.edit"],
  program: ["program.edit"],
  labour: ["labour.view", "worker.edit"],
  forecast: ["forecast.view"],
  compliance: ["compliance.manage"],
  allocation: ["allocation.edit"],
  site: ["site.update"],
  scorecard: ["scorecard.view", "scorecard.assess"],
  document: ["doc.view", "doc.edit", "doc.generate"],
  finance: ["finance.view", "finance.edit", "finance.approve"],
  import: ["import.run"],
  dashboard: ["dashboard.director", "dashboard.pm"],
  admin: [
    "admin.users",
    "admin.roles",
    "admin.ai",
    "admin.billing",
    "admin.modules",
    "admin.branding",
    "admin.audit",
    "admin.settings",
  ],
  ai: ["ai.assistant.use"],
  platform: ["platform.superadmin"],
} as const;

export const ALL_PERMISSIONS = Object.values(PERMISSION_GROUPS).flat();

export type PermissionSlug = (typeof ALL_PERMISSIONS)[number];
