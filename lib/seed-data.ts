import { PERMISSION_GROUPS } from "./permissions";

// Shared between prisma/seed.ts (Paracon demo data) and lib/organisations.ts
// (provisioning a brand-new tenant from the Super Admin area) so both paths
// create the same permissions/roles/modules instead of two copies drifting.

export const PERMISSION_LABELS: Record<string, string> = {
  "tender.view": "View tenders",
  "tender.edit": "Edit tenders",
  "project.view": "View projects",
  "project.edit": "Edit projects",
  "program.edit": "Edit construction program",
  "labour.view": "View labour intelligence",
  "worker.edit": "Edit worker records",
  "compliance.manage": "Manage compliance documents",
  "allocation.edit": "Edit resource allocation",
  "site.update": "Submit site daily updates",
  "dashboard.director": "View Director dashboard",
  "dashboard.pm": "View PM dashboard",
  "admin.users": "Manage users",
  "admin.roles": "Manage roles & permissions",
  "admin.ai": "Manage AI settings",
  "admin.billing": "Manage billing",
  "admin.modules": "Manage modules",
  "admin.branding": "Manage branding",
  "admin.audit": "View audit log",
  "admin.settings": "Manage settings registry",
  "ai.assistant.use": "Use AI assistant",
  "platform.superadmin": "Super admin (all tenants)",
};

export const ROLE_DEFINITIONS = [
  {
    slug: "director",
    name: "Director",
    permissions: [
      ...PERMISSION_GROUPS.admin,
      ...PERMISSION_GROUPS.tender,
      ...PERMISSION_GROUPS.project,
      ...PERMISSION_GROUPS.program,
      ...PERMISSION_GROUPS.labour,
      ...PERMISSION_GROUPS.compliance,
      ...PERMISSION_GROUPS.allocation,
      ...PERMISSION_GROUPS.dashboard,
      ...PERMISSION_GROUPS.ai,
    ],
  },
  {
    slug: "project-manager",
    name: "Project Manager",
    permissions: [
      "project.view",
      "project.edit",
      "program.edit",
      "labour.view",
      "worker.edit",
      "allocation.edit",
      "dashboard.pm",
      "ai.assistant.use",
    ],
  },
  {
    slug: "site-foreman",
    name: "Site Foreman",
    permissions: ["site.update"],
  },
  {
    slug: "estimator",
    name: "Estimator",
    permissions: ["tender.view", "tender.edit", "ai.assistant.use"],
  },
  {
    slug: "viewer",
    name: "Viewer",
    permissions: ["project.view", "tender.view", "dashboard.pm"],
  },
] as const;

export const MODULES = [
  { slug: "tender", label: "Tender Pipeline", description: "Tender register and pipeline KPIs" },
  { slug: "projects", label: "Projects & Program", description: "Project register and construction program" },
  { slug: "labour", label: "Labour Intelligence", description: "Worker database and skills matrix" },
  { slug: "forecast", label: "Forecast & Capacity", description: "Labour demand/supply forecast engine" },
  { slug: "allocation", label: "Resource Allocation", description: "Worker allocation planner" },
  { slug: "site-updates", label: "Site Daily Updates", description: "Foreman mobile daily update flow" },
  { slug: "productivity", label: "Productivity & Estimating", description: "Productivity DB and estimating feedback loop" },
] as const;

export const CONFIG_DEFAULTS = [
  {
    key: "tender.statusList",
    group: "tender",
    type: "LIST" as const,
    label: "Tender statuses",
    description: "Status options available on a tender.",
    valueJson: ["In Progress", "Submitted", "Won", "Lost", "Withdrawn", "Post Tender"],
  },
  {
    key: "tender.winProbWeights",
    group: "tender",
    type: "WEIGHTS" as const,
    label: "Win probability weights",
    description: "Numeric weight applied per win-probability text value.",
    valueJson: { High: 0.8, Medium: 0.5, Low: 0.2 },
  },
  {
    key: "tender.statusWeights",
    group: "tender",
    type: "WEIGHTS" as const,
    label: "Status weights",
    description: "Numeric weight applied per tender status for weighted pipeline.",
    valueJson: {
      "In Progress": 0.3,
      Submitted: 0.5,
      "Post Tender": 0.2,
      Won: 1.0,
      Lost: 0.0,
      Withdrawn: 0.0,
    },
  },
  {
    key: "tender.valueBands",
    group: "tender",
    type: "BANDS" as const,
    label: "Tender value bands",
    description: "Bid-size bands used for pipeline intelligence.",
    valueJson: [
      { label: "<500k", max: 500_000 },
      { label: "500k–1m", max: 1_000_000 },
      { label: "1m–1.5m", max: 1_500_000 },
      { label: ">1.5m", max: null },
    ],
  },
  {
    key: "forecast.ragThresholds",
    group: "forecast",
    type: "WEIGHTS" as const,
    label: "Forecast RAG thresholds",
    description: "Coverage ratio thresholds for green/amber/red capacity status.",
    valueJson: { green: 1.0, amber: 0.85, red: 0.7 },
  },
  {
    key: "forecast.blockLengthDays",
    group: "forecast",
    type: "NUMBER" as const,
    label: "Forecast block length (days)",
    description: "Length of each demand/supply block in the forecast engine.",
    valueJson: 7,
  },
  {
    key: "trade.capabilityList",
    group: "labour",
    type: "LIST" as const,
    label: "Trade / capability list",
    description: "Worker trade and capability tags available across the app.",
    valueJson: ["Carpenter", "Electrician", "Plumber", "Plasterer", "Painter", "Site Labourer", "Project Engineer"],
  },
  {
    key: "branding.accentSwatches",
    group: "branding",
    type: "LIST" as const,
    label: "Allowed accent colours",
    description: "Brand-guardrail accent swatches an org can choose for its theme.",
    valueJson: ["#B08D57", "#9C7A4A", "#C49B63", "#8A6F3F", "#A6824F"],
  },
];
