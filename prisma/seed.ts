import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt } from "../lib/crypto";
import { PERMISSION_GROUPS } from "../lib/permissions";
import { PERMISSION_LABELS, ROLE_DEFINITIONS, MODULES, CONFIG_DEFAULTS } from "../lib/seed-data";
import { computeComplianceStatus } from "../lib/labour/compliance";
import { startOfIsoWeek, startOfMonth, addMonths } from "../lib/dates";
import { recomputeProductivity } from "../lib/scorecard/productivity-service";
import { loadScorecardConfig } from "../lib/scorecard/config";
import { calcOverallScore } from "../lib/scorecard/calc";
import { deriveTenderComputedFields, loadTenderConfig } from "../lib/tenders/config";
import { defaultDocumentTemplateConfig } from "../lib/documents/templates-config";
import { calcRetentionForClaim } from "../lib/finance/retention";
import type { VariationSnapshot, ProgressClaimSnapshot } from "../lib/documents/types";

const prisma = new PrismaClient();

const DEMO_USERS = [
  { email: "director@paracon.com.au", name: "Avery Director", roleSlug: "director" },
  { email: "pm@paracon.com.au", name: "Priya Manager", roleSlug: "project-manager" },
  { email: "foreman@paracon.com.au", name: "Frank Foreman", roleSlug: "site-foreman" },
  { email: "estimator@paracon.com.au", name: "Elliot Estimator", roleSlug: "estimator" },
] as const;

const DEMO_PASSWORD = "Demo1234!";

const SUPER_ADMIN_EMAIL = "superadmin@oneparacon.com";

// Matches the seeded compliance.expiringThresholdDays Config default — used to
// pre-compute a realistic Valid/Expiring/Expired status for each demo record.
const COMPLIANCE_EXPIRING_THRESHOLD_DAYS = 30;

const DEMO_SKILLS = [
  "Formwork",
  "Fit-out Carpentry",
  "Joinery Install",
  "Ceiling & Partition Systems",
  "Glazing",
  "Switchboard Install",
  "Data Cabling",
  "Site Safety Leadership",
] as const;

type DemoCompliance = { type: string; reference?: string; issuedDate?: Date; expiryDate?: Date | null };
type DemoWorker = {
  name: string;
  phone: string;
  capability: string;
  employmentType: string;
  status: string;
  baseLocation: string;
  performance: { quality: number; reliability: number; productivity: number; safety: number };
  skills: { skill: string; level: number }[];
  compliance: DemoCompliance[];
  leave?: { startDate: Date; endDate: Date; reason: string };
  isKeyStaff?: boolean;
};

const today = new Date();
function daysFromNow(days: number): Date {
  return new Date(today.getTime() + days * 86_400_000);
}
function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

const DEMO_WORKERS: DemoWorker[] = [
  {
    name: "Marcus Webb",
    phone: "0411 222 001",
    capability: "Site Foreman",
    employmentType: "Direct Employee",
    status: "Available",
    baseLocation: "North Melbourne",
    isKeyStaff: true,
    performance: { quality: 4.5, reliability: 5, productivity: 4.5, safety: 5 },
    skills: [
      { skill: "Fit-out Carpentry", level: 5 },
      { skill: "Site Safety Leadership", level: 5 },
    ],
    compliance: [
      { type: "White Card", reference: "WC-10021", issuedDate: daysAgo(700), expiryDate: daysFromNow(900) },
      { type: "Company Induction", reference: "CI-1001", issuedDate: daysAgo(120) },
    ],
  },
  {
    name: "Daniel Okafor",
    phone: "0411 222 002",
    capability: "Lead Carpenter",
    employmentType: "Direct Employee",
    status: "Assigned",
    baseLocation: "Brunswick",
    isKeyStaff: true,
    performance: { quality: 4.5, reliability: 4, productivity: 4.5, safety: 4.5 },
    skills: [
      { skill: "Fit-out Carpentry", level: 5 },
      { skill: "Joinery Install", level: 4 },
      { skill: "Formwork", level: 3 },
    ],
    compliance: [
      { type: "White Card", reference: "WC-10022", issuedDate: daysAgo(500), expiryDate: daysFromNow(700) },
      { type: "Company Induction", reference: "CI-1002", issuedDate: daysAgo(90) },
    ],
  },
  {
    name: "Tane Williams",
    phone: "0411 222 003",
    capability: "All-round Carpenter",
    employmentType: "Direct Employee",
    status: "Available",
    baseLocation: "Coburg",
    performance: { quality: 4, reliability: 4, productivity: 4, safety: 4 },
    skills: [
      { skill: "Fit-out Carpentry", level: 4 },
      { skill: "Joinery Install", level: 3 },
      { skill: "Ceiling & Partition Systems", level: 3 },
    ],
    compliance: [
      { type: "White Card", reference: "WC-10023", issuedDate: daysAgo(300), expiryDate: daysFromNow(600) },
      { type: "Company Induction", reference: "CI-1003", issuedDate: daysAgo(60) },
    ],
  },
  {
    name: "Jacob Ferreira",
    phone: "0411 222 004",
    capability: "Carpenter",
    employmentType: "Subcontractor",
    status: "Available",
    baseLocation: "Essendon",
    performance: { quality: 3.5, reliability: 3.5, productivity: 4, safety: 3.5 },
    skills: [
      { skill: "Fit-out Carpentry", level: 3 },
      { skill: "Formwork", level: 3 },
    ],
    compliance: [
      // Expires within the 30-day threshold — this is the worker the acceptance
      // criterion ("an expiring White Card raises an alert") is built around.
      { type: "White Card", reference: "WC-10024", issuedDate: daysAgo(1065), expiryDate: daysFromNow(20) },
      { type: "Company Induction", reference: "CI-1004", issuedDate: daysAgo(45) },
    ],
  },
  {
    name: "Liam Foster",
    phone: "0411 222 005",
    capability: "Carpenter",
    employmentType: "Direct Employee",
    status: "On Leave",
    baseLocation: "Fitzroy",
    performance: { quality: 4, reliability: 3.5, productivity: 3.5, safety: 4 },
    skills: [{ skill: "Fit-out Carpentry", level: 3 }],
    compliance: [
      { type: "White Card", reference: "WC-10025", issuedDate: daysAgo(400), expiryDate: daysFromNow(500) },
      { type: "Company Induction", reference: "CI-1005", issuedDate: daysAgo(100) },
    ],
    leave: { startDate: daysAgo(2), endDate: daysFromNow(5), reason: "Annual leave" },
  },
  {
    name: "Priya Nair",
    phone: "0411 222 006",
    capability: "Electrician",
    employmentType: "Subcontractor",
    status: "Available",
    baseLocation: "Thornbury",
    performance: { quality: 4.5, reliability: 4.5, productivity: 4, safety: 4.5 },
    skills: [
      { skill: "Switchboard Install", level: 5 },
      { skill: "Data Cabling", level: 4 },
    ],
    compliance: [
      { type: "White Card", reference: "WC-10026", issuedDate: daysAgo(800), expiryDate: daysFromNow(400) },
      { type: "License", reference: "EL-44210", issuedDate: daysAgo(900), expiryDate: daysFromNow(365) },
    ],
  },
  {
    name: "Sione Taufa",
    phone: "0411 222 007",
    capability: "Plumber",
    employmentType: "Subcontractor",
    status: "Assigned",
    baseLocation: "Reservoir",
    performance: { quality: 4, reliability: 3.5, productivity: 4, safety: 3.5 },
    skills: [{ skill: "Fit-out Carpentry", level: 1 }],
    compliance: [
      { type: "White Card", reference: "WC-10027", issuedDate: daysAgo(600), expiryDate: daysFromNow(300) },
      // Already expired — demonstrates the Expired branch alongside Jacob's Expiring one.
      { type: "Ticket", reference: "EWP-7781", issuedDate: daysAgo(800), expiryDate: daysAgo(30) },
    ],
  },
  {
    name: "Grace Halloran",
    phone: "0411 222 008",
    capability: "Plasterer",
    employmentType: "Direct Employee",
    status: "Available",
    baseLocation: "Northcote",
    performance: { quality: 4.5, reliability: 4.5, productivity: 4, safety: 4 },
    skills: [{ skill: "Ceiling & Partition Systems", level: 5 }],
    compliance: [
      { type: "White Card", reference: "WC-10028", issuedDate: daysAgo(250), expiryDate: daysFromNow(800) },
      { type: "Company Induction", reference: "CI-1008", issuedDate: daysAgo(40) },
    ],
  },
  {
    name: "Owen Fitzgerald",
    phone: "0411 222 009",
    capability: "Painter",
    employmentType: "Casual",
    status: "Available",
    baseLocation: "Carlton",
    performance: { quality: 3.5, reliability: 3.5, productivity: 3.5, safety: 3.5 },
    skills: [],
    compliance: [{ type: "White Card", reference: "WC-10029", issuedDate: daysAgo(150), expiryDate: daysFromNow(600) }],
  },
  {
    name: "Mei Lin Tan",
    phone: "0411 222 010",
    capability: "Site Labourer",
    employmentType: "Casual",
    status: "Available",
    baseLocation: "West Melbourne",
    performance: { quality: 3.5, reliability: 4, productivity: 3.5, safety: 4 },
    skills: [],
    compliance: [
      { type: "White Card", reference: "WC-10030", issuedDate: daysAgo(90), expiryDate: daysFromNow(900) },
      { type: "Company Induction", reference: "CI-1010", issuedDate: daysAgo(20) },
    ],
  },
  {
    name: "Connor Doyle",
    phone: "0411 222 011",
    capability: "Project Engineer",
    employmentType: "Direct Employee",
    status: "Available",
    baseLocation: "North Melbourne",
    performance: { quality: 4.5, reliability: 4.5, productivity: 4.5, safety: 4.5 },
    skills: [{ skill: "Site Safety Leadership", level: 4 }],
    compliance: [
      { type: "White Card", reference: "WC-10031", issuedDate: daysAgo(900), expiryDate: daysFromNow(365) },
      { type: "Company Induction", reference: "CI-1011", issuedDate: daysAgo(200) },
    ],
  },
  {
    name: "Hassan Ali",
    phone: "0411 222 012",
    capability: "All-round Carpenter",
    employmentType: "Direct Employee",
    status: "Assigned",
    baseLocation: "Pascoe Vale",
    performance: { quality: 4, reliability: 4, productivity: 4, safety: 4 },
    skills: [
      { skill: "Fit-out Carpentry", level: 4 },
      { skill: "Glazing", level: 2 },
    ],
    compliance: [
      { type: "White Card", reference: "WC-10032", issuedDate: daysAgo(350), expiryDate: daysFromNow(700) },
      { type: "Uniform", reference: "UNI-220", issuedDate: daysAgo(60) },
    ],
  },
];

// Forecast & Capacity demo data (clients, secured projects + program, pipeline
// tender). Deliberately sized against the 12 DEMO_WORKERS above so the
// forecast matrix shows a realistic mix: some trades exactly covered (e.g.
// Site Foreman, Electrician), some short on secured work alone (Plumber has
// zero supply — Sione is "Assigned" — so any plumbing demand is short), and
// Carpenter only goes short once the pipeline tender stacks onto the live
// projects' demand in the later blocks (the vision doc's "stack likely
// tenders onto live projects" forecasting behaviour).

const DEMO_CLIENTS = ["Meridian Funds Management", "Beacon Cove Developments"] as const;

type DemoActivity = {
  name: string;
  trade: string;
  startOffsetDays: number;
  endOffsetDays: number;
  labourRequired: Record<string, number>;
};

type DemoProject = {
  name: string;
  code: string;
  status: string;
  value: number;
  clientName: (typeof DEMO_CLIENTS)[number];
  startOffsetDays: number;
  endOffsetDays: number;
  activities: DemoActivity[];
};

const DEMO_PROJECTS: DemoProject[] = [
  {
    name: "Riverside Quarter Fitout",
    code: "P26-1001",
    status: "On Track",
    value: 850_000,
    clientName: "Meridian Funds Management",
    startOffsetDays: 0,
    endOffsetDays: 84,
    activities: [
      { name: "Carpentry fit-out", trade: "Carpenter", startOffsetDays: 0, endOffsetDays: 41, labourRequired: { Carpenter: 2 } },
      {
        name: "All-round carpentry support",
        trade: "All-round Carpenter",
        startOffsetDays: 0,
        endOffsetDays: 20,
        labourRequired: { "All-round Carpenter": 1 },
      },
      { name: "Plastering", trade: "Plasterer", startOffsetDays: 21, endOffsetDays: 62, labourRequired: { Plasterer: 1 } },
      { name: "Electrical rough-in", trade: "Electrician", startOffsetDays: 7, endOffsetDays: 34, labourRequired: { Electrician: 1 } },
      {
        name: "Site supervision",
        trade: "Site Foreman",
        startOffsetDays: 0,
        endOffsetDays: 83,
        labourRequired: { "Site Foreman": 1 },
      },
    ],
  },
  {
    name: "Beacon Cove Office Upgrade",
    code: "P26-1002",
    status: "Attention",
    value: 420_000,
    clientName: "Beacon Cove Developments",
    startOffsetDays: 14,
    endOffsetDays: 77,
    activities: [
      { name: "Plumbing rough-in", trade: "Plumber", startOffsetDays: 14, endOffsetDays: 48, labourRequired: { Plumber: 2 } },
      { name: "Painting", trade: "Painter", startOffsetDays: 49, endOffsetDays: 69, labourRequired: { Painter: 2 } },
      {
        name: "Carpentry finishing",
        trade: "Carpenter",
        startOffsetDays: 42,
        endOffsetDays: 62,
        labourRequired: { Carpenter: 1 },
      },
    ],
  },
];

// Phase 9 Resource Planner demo allocations — deliberately NOT a 1:1 cover of
// every trade's requirement, so the planner shows a realistic mix on first
// load: Site Foreman / All-round Carpenter / Electrician / Plasterer fully
// covered; Carpenter on Riverside short by 1 (Liam Foster is on leave, so
// only Jacob Ferreira is allocated against a requirement of 2); Painter on
// Beacon Cove short by 1 (only one Painter exists); and Plumber on Beacon
// Cove left at zero on purpose — Sione Taufa is the only Plumber but his EWP
// ticket is expired, so the compliance guard blocks him from ever appearing
// here, demonstrating the block rather than just unit-testing it.
const DEMO_ALLOCATIONS: { projectCode: string; workerName: string; weekOffsetDays: number[] }[] = [
  { projectCode: "P26-1001", workerName: "Marcus Webb", weekOffsetDays: [0, 7, 14] },
  { projectCode: "P26-1001", workerName: "Jacob Ferreira", weekOffsetDays: [0, 7, 14] },
  { projectCode: "P26-1001", workerName: "Tane Williams", weekOffsetDays: [0, 7, 14] },
  { projectCode: "P26-1001", workerName: "Priya Nair", weekOffsetDays: [7, 14] },
  { projectCode: "P26-1001", workerName: "Grace Halloran", weekOffsetDays: [21, 28] },
  { projectCode: "P26-1002", workerName: "Owen Fitzgerald", weekOffsetDays: [49, 56] },
  { projectCode: "P26-1002", workerName: "Jacob Ferreira", weekOffsetDays: [42, 49] },
];

type DemoTender = {
  projectName: string;
  address: string;
  status: string;
  winProbabilityText: string;
  value: number;
  clientName: (typeof DEMO_CLIENTS)[number];
  receivedOffsetDays: number;
  dueOffsetDays: number;
  submittedOffsetDays: number;
  expectedStartOffsetDays: number;
  expectedEndOffsetDays: number;
  expectedLabour: Record<string, number>;
  bidDecision: string;
  intent: string;
};

const DEMO_TENDERS: DemoTender[] = [
  {
    projectName: "Yarra Quarter Stage 2 Fitout",
    address: "120 Buckhurst Street, South Melbourne VIC 3205",
    status: "Submitted",
    winProbabilityText: "High",
    value: 600_000,
    clientName: "Meridian Funds Management",
    receivedOffsetDays: -10,
    dueOffsetDays: 4,
    submittedOffsetDays: -2,
    expectedStartOffsetDays: 56,
    expectedEndOffsetDays: 83,
    expectedLabour: { Carpenter: 2, "Site Labourer": 1 },
    bidDecision: "Go",
    intent: "Pursue",
  },
];

async function main() {
  console.log("Seeding permissions...");
  for (const slug of Object.values(PERMISSION_GROUPS).flat()) {
    const group = slug.split(".")[0];
    await prisma.permission.upsert({
      where: { slug },
      update: {},
      create: { slug, group, label: PERMISSION_LABELS[slug] ?? slug },
    });
  }

  console.log("Seeding Paracon Group...");

  const org = await prisma.organisation.upsert({
    where: { slug: "paracon" },
    update: {
      legalName: "Paracon Group Pty Ltd",
      abn: "80 317 795 082",
      registeredAddress: "Unit 10/65 Mark Street, North Melbourne VIC 3051",
    },
    create: {
      name: "Paracon Group",
      slug: "paracon",
      primaryColor: "#B08D57",
      // Current legal entity (CLAUDE.md rule 14) — the legacy templates in the
      // source Drive data still carry the retired ABN (42 166 362 625).
      legalName: "Paracon Group Pty Ltd",
      abn: "80 317 795 082",
      registeredAddress: "Unit 10/65 Mark Street, North Melbourne VIC 3051",
    },
  });

  // Roles + RolePermission
  const roleIdBySlug = new Map<string, string>();
  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { organisationId_slug: { organisationId: org.id, slug: def.slug } },
      update: { name: def.name },
      create: {
        organisationId: org.id,
        name: def.name,
        slug: def.slug,
        isSystem: true,
      },
    });
    roleIdBySlug.set(def.slug, role.id);

    for (const permSlug of def.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { slug: permSlug } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // Demo users
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const user of DEMO_USERS) {
    const roleId = roleIdBySlug.get(user.roleSlug);
    if (!roleId) throw new Error(`Role not seeded: ${user.roleSlug}`);

    await prisma.user.upsert({
      where: { organisationId_email: { organisationId: org.id, email: user.email } },
      update: { name: user.name, roleId },
      create: {
        organisationId: org.id,
        email: user.email,
        name: user.name,
        hashedPassword,
        roleId,
      },
    });
  }

  // Modules + per-org toggle
  for (const mod of MODULES) {
    const moduleRow = await prisma.module.upsert({
      where: { slug: mod.slug },
      update: { label: mod.label, description: mod.description },
      create: { ...mod, isSystem: true },
    });
    await prisma.organisationModule.upsert({
      where: { organisationId_moduleId: { organisationId: org.id, moduleId: moduleRow.id } },
      update: { enabled: true },
      create: { organisationId: org.id, moduleId: moduleRow.id, enabled: true },
    });
  }

  // GLOBAL AI setting from env
  const openAiKey = process.env.OPENAI_API_KEY;
  const existingGlobal = await prisma.aiSetting.findFirst({ where: { scope: "GLOBAL" } });
  if (!existingGlobal) {
    await prisma.aiSetting.create({
      data: {
        scope: "GLOBAL",
        provider: "openai",
        model: "gpt-4o-mini",
        apiKeyEncrypted: encrypt(openAiKey ?? "REPLACE_ME"),
        temperature: 0.7,
        maxTokens: 2000,
        enabled: !!openAiKey,
      },
    });
    if (!openAiKey) {
      console.warn(
        "OPENAI_API_KEY not set — seeded GLOBAL AiSetting is disabled. Set it and re-run to enable AI features."
      );
    }
  }

  // Settings registry — platform defaults (organisationId: null). Unique constraint on
  // (organisationId, key) doesn't hold for null organisationId in SQL, so upsert-by-find
  // rather than relying on Prisma's compound-unique upsert.
  console.log("Seeding Config registry defaults...");
  for (const def of CONFIG_DEFAULTS) {
    const existing = await prisma.config.findFirst({ where: { organisationId: null, key: def.key } });
    if (existing) {
      await prisma.config.update({
        where: { id: existing.id },
        data: {
          group: def.group,
          type: def.type,
          label: def.label,
          description: def.description,
          valueJson: def.valueJson,
        },
      });
    } else {
      await prisma.config.create({
        data: {
          organisationId: null,
          key: def.key,
          group: def.group,
          type: def.type,
          label: def.label,
          description: def.description,
          valueJson: def.valueJson,
          isSystem: true,
        },
      });
    }
  }

  // Documents & Templates engine — org-level generation config (scope-builder
  // library, qualifications boilerplate, PDF colour tokens). CONFIG NOT CODE:
  // these rows are what the admin Document Templates screen edits; the
  // generators always read from here, never from a hard-coded constant.
  console.log("Seeding Document Templates...");
  for (const type of ["TENDER_LETTER", "VARIATION", "PROGRESS_CLAIM"] as const) {
    await prisma.documentTemplate.upsert({
      where: { organisationId_type: { organisationId: org.id, type } },
      update: {},
      create: {
        organisationId: org.id,
        type,
        configJson: defaultDocumentTemplateConfig(type),
      },
    });
  }

  // Labour Intelligence demo data (workers, skills, compliance, leave)
  console.log("Seeding Labour Intelligence demo data...");

  const skillIdByName = new Map<string, string>();
  for (const name of DEMO_SKILLS) {
    const skill = await prisma.skill.upsert({
      where: { organisationId_name: { organisationId: org.id, name } },
      update: {},
      create: { organisationId: org.id, name },
    });
    skillIdByName.set(name, skill.id);
  }

  const workerIdByName = new Map<string, string>();
  for (const demoWorker of DEMO_WORKERS) {
    const existingWorker = await prisma.worker.findFirst({ where: { organisationId: org.id, name: demoWorker.name } });
    const worker = existingWorker
      ? await prisma.worker.update({
          where: { id: existingWorker.id },
          data: {
            phone: demoWorker.phone,
            capability: demoWorker.capability,
            employmentType: demoWorker.employmentType,
            status: demoWorker.status,
            baseLocation: demoWorker.baseLocation,
            isKeyStaff: demoWorker.isKeyStaff ?? false,
          },
        })
      : await prisma.worker.create({
          data: {
            organisationId: org.id,
            name: demoWorker.name,
            phone: demoWorker.phone,
            capability: demoWorker.capability,
            employmentType: demoWorker.employmentType,
            status: demoWorker.status,
            baseLocation: demoWorker.baseLocation,
            isKeyStaff: demoWorker.isKeyStaff ?? false,
          },
        });

    await prisma.workerPerformance.upsert({
      where: { workerId: worker.id },
      update: demoWorker.performance,
      create: { workerId: worker.id, ...demoWorker.performance },
    });

    await prisma.workerSkill.deleteMany({ where: { workerId: worker.id } });
    for (const { skill, level } of demoWorker.skills) {
      const skillId = skillIdByName.get(skill);
      if (!skillId) throw new Error(`Unknown demo skill "${skill}"`);
      await prisma.workerSkill.create({ data: { workerId: worker.id, skillId, level } });
    }

    await prisma.compliance.deleteMany({ where: { workerId: worker.id } });
    for (const c of demoWorker.compliance) {
      const expiryDate = c.expiryDate ?? null;
      const status = computeComplianceStatus(expiryDate, COMPLIANCE_EXPIRING_THRESHOLD_DAYS, today);
      await prisma.compliance.create({
        data: {
          organisationId: org.id,
          workerId: worker.id,
          type: c.type,
          reference: c.reference,
          issuedDate: c.issuedDate,
          expiryDate,
          status,
        },
      });
    }

    await prisma.workerLeave.deleteMany({ where: { workerId: worker.id } });
    if (demoWorker.leave) {
      await prisma.workerLeave.create({
        data: {
          organisationId: org.id,
          workerId: worker.id,
          startDate: demoWorker.leave.startDate,
          endDate: demoWorker.leave.endDate,
          reason: demoWorker.leave.reason,
        },
      });
    }

    workerIdByName.set(demoWorker.name, worker.id);
  }

  // Forecast & Capacity demo data — clients, secured projects + program
  // activities, and a pipeline tender, sized against the workers above so
  // the forecast matrix (Phase 5) shows a realistic mix of Covered/Short.
  console.log("Seeding Forecast & Capacity demo data...");

  const clientIdByName = new Map<string, string>();
  for (const name of DEMO_CLIENTS) {
    const client = await prisma.client.upsert({
      where: { organisationId_name: { organisationId: org.id, name } },
      update: {},
      create: { organisationId: org.id, name, status: "Pricing" },
    });
    clientIdByName.set(name, client.id);
  }

  const projectIdByCode = new Map<string, string>();
  for (const demoProject of DEMO_PROJECTS) {
    const clientId = clientIdByName.get(demoProject.clientName);
    if (!clientId) throw new Error(`Unknown demo client "${demoProject.clientName}"`);

    const project = await prisma.project.upsert({
      where: { organisationId_code: { organisationId: org.id, code: demoProject.code } },
      update: {
        name: demoProject.name,
        status: demoProject.status,
        value: demoProject.value,
        clientId,
        startDate: daysFromNow(demoProject.startOffsetDays),
        endDate: daysFromNow(demoProject.endOffsetDays),
      },
      create: {
        organisationId: org.id,
        name: demoProject.name,
        code: demoProject.code,
        status: demoProject.status,
        value: demoProject.value,
        clientId,
        startDate: daysFromNow(demoProject.startOffsetDays),
        endDate: daysFromNow(demoProject.endOffsetDays),
      },
    });

    for (const demoActivity of demoProject.activities) {
      const existingActivity = await prisma.programActivity.findFirst({
        where: { projectId: project.id, name: demoActivity.name },
      });
      const activityData = {
        organisationId: org.id,
        projectId: project.id,
        name: demoActivity.name,
        trade: demoActivity.trade,
        startDate: daysFromNow(demoActivity.startOffsetDays),
        endDate: daysFromNow(demoActivity.endOffsetDays),
        status: "On Track",
        labourRequired: demoActivity.labourRequired,
      };
      if (existingActivity) {
        await prisma.programActivity.update({ where: { id: existingActivity.id }, data: activityData });
      } else {
        await prisma.programActivity.create({ data: activityData });
      }
    }

    projectIdByCode.set(demoProject.code, project.id);
  }

  // Phase 9 Resource Planner demo allocations — see DEMO_ALLOCATIONS for the
  // deliberate covered/short/blocked mix. Cleared and recreated on every seed
  // run for determinism, same as compliance/leave above.
  console.log("Seeding Resource Planner demo allocations...");
  await prisma.allocation.deleteMany({ where: { organisationId: org.id } });
  for (const demoAllocation of DEMO_ALLOCATIONS) {
    const projectId = projectIdByCode.get(demoAllocation.projectCode);
    if (!projectId) throw new Error(`Unknown demo project "${demoAllocation.projectCode}"`);
    const workerId = workerIdByName.get(demoAllocation.workerName);
    if (!workerId) throw new Error(`Unknown demo worker "${demoAllocation.workerName}"`);

    const weekStarts = new Set(demoAllocation.weekOffsetDays.map((offset) => startOfIsoWeek(daysFromNow(offset)).getTime()));
    for (const weekStartMs of weekStarts) {
      await prisma.allocation.create({
        data: { organisationId: org.id, workerId, projectId, weekStart: new Date(weekStartMs) },
      });
    }
  }

  const tenderConfig = await loadTenderConfig(org.id);
  for (const demoTender of DEMO_TENDERS) {
    const clientId = clientIdByName.get(demoTender.clientName);
    if (!clientId) throw new Error(`Unknown demo client "${demoTender.clientName}"`);

    const received = daysFromNow(demoTender.receivedOffsetDays);
    const due = daysFromNow(demoTender.dueOffsetDays);
    const computed = deriveTenderComputedFields(
      { value: demoTender.value, winProbabilityText: demoTender.winProbabilityText, received, due },
      tenderConfig
    );

    await prisma.tender.upsert({
      where: {
        organisationId_projectName_clientId: { organisationId: org.id, projectName: demoTender.projectName, clientId },
      },
      update: {
        address: demoTender.address,
        status: demoTender.status,
        received,
        due,
        submitted: daysFromNow(demoTender.submittedOffsetDays),
        value: demoTender.value,
        winProbabilityText: demoTender.winProbabilityText,
        bidDecision: demoTender.bidDecision,
        intent: demoTender.intent,
        expectedStart: daysFromNow(demoTender.expectedStartOffsetDays),
        expectedEnd: daysFromNow(demoTender.expectedEndOffsetDays),
        expectedLabour: demoTender.expectedLabour,
        ...computed,
      },
      create: {
        organisationId: org.id,
        projectName: demoTender.projectName,
        address: demoTender.address,
        status: demoTender.status,
        received,
        due,
        submitted: daysFromNow(demoTender.submittedOffsetDays),
        value: demoTender.value,
        clientId,
        winProbabilityText: demoTender.winProbabilityText,
        bidDecision: demoTender.bidDecision,
        intent: demoTender.intent,
        expectedStart: daysFromNow(demoTender.expectedStartOffsetDays),
        expectedEnd: daysFromNow(demoTender.expectedEndOffsetDays),
        expectedLabour: demoTender.expectedLabour,
        ...computed,
      },
    });
  }

  // Document Management + Import Centre demo data — a representative mix of
  // stored files and Drive links across both a project and a tender, so the
  // unified Documents panel doesn't look empty in the demo. Object keys are
  // placeholders (no demo bytes are pushed to real storage); LinkedDocument
  // never needs storage at all — it's just a saved URL + metadata.
  console.log("Seeding Document Management demo data...");

  const docDemoProject = await prisma.project.update({
    where: { organisationId_code: { organisationId: org.id, code: "P26-1001" } },
    data: {
      tradePackages: [
        { name: "Partitions", contractValue: 510_000 },
        { name: "Doors", contractValue: 145_000 },
        { name: "Ceiling", contractValue: 195_000 },
      ],
    },
  });
  const docDemoTender = await prisma.tender.findFirstOrThrow({
    where: { organisationId: org.id, projectName: "Yarra Quarter Stage 2 Fitout" },
  });
  await prisma.tender.update({
    where: { id: docDemoTender.id },
    data: {
      tradePackages: [
        { name: "Partitions", contractValue: 0 },
        { name: "Doors", contractValue: 0 },
        { name: "Ceiling", contractValue: 0 },
      ],
    },
  });

  const demoStoredFiles: {
    name: string;
    mime: string;
    size: number;
    category: string;
    projectId?: string;
    tenderId?: string;
  }[] = [
    {
      name: "Riverside Quarter Invoice Proforma.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 48_000,
      category: "Submission, Contract & Claims",
      projectId: docDemoProject.id,
    },
    {
      name: "VQ-01 Day Labour Works.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 22_000,
      category: "Submission, Contract & Claims",
      projectId: docDemoProject.id,
    },
    {
      name: "General Fitout SWMS 001.pdf",
      mime: "application/pdf",
      size: 1_240_000,
      category: "Site File",
      projectId: docDemoProject.id,
    },
    {
      name: "Preliminary Pricing Pack.pdf",
      mime: "application/pdf",
      size: 860_000,
      category: "Documentation",
      tenderId: docDemoTender.id,
    },
  ];

  for (const file of demoStoredFiles) {
    const existing = await prisma.storedFile.findFirst({
      where: {
        organisationId: org.id,
        name: file.name,
        projectId: file.projectId ?? null,
        tenderId: file.tenderId ?? null,
      },
    });
    if (existing) continue;
    const scope = file.projectId ? `projects/${file.projectId}` : `tenders/${file.tenderId}`;
    await prisma.storedFile.create({
      data: {
        organisationId: org.id,
        key: `seed/${scope}/${file.name}`,
        name: file.name,
        mime: file.mime,
        size: file.size,
        category: file.category,
        projectId: file.projectId,
        tenderId: file.tenderId,
      },
    });
  }

  const demoLinkedDocs: { name: string; driveUrl: string; kind: string; projectId?: string; tenderId?: string }[] = [
    {
      name: "Architectural Drawing Set (I---0000…I---7010)",
      driveUrl: "https://drive.google.com/drive/folders/1A2B3C4D5E6F-demo-riverside-drawings",
      kind: "Drawing Set",
      projectId: docDemoProject.id,
    },
    {
      name: "Trade Breakdown.xlsx",
      driveUrl: "https://drive.google.com/file/d/1G7H8I9J0K-demo-yarra-breakdown/view",
      kind: "Other",
      tenderId: docDemoTender.id,
    },
  ];

  for (const doc of demoLinkedDocs) {
    const existing = await prisma.linkedDocument.findFirst({
      where: { organisationId: org.id, name: doc.name, projectId: doc.projectId ?? null, tenderId: doc.tenderId ?? null },
    });
    if (existing) continue;
    await prisma.linkedDocument.create({
      data: {
        organisationId: org.id,
        name: doc.name,
        driveUrl: doc.driveUrl,
        kind: doc.kind,
        projectId: doc.projectId,
        tenderId: doc.tenderId,
      },
    });
  }

  const demoEstimateLineItems: {
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    amount: number;
    projectId?: string;
    tenderId?: string;
  }[] = [
    { description: "Solid Partition - P1", quantity: 84, unit: "lm", unitRate: 145, amount: 12_180, projectId: docDemoProject.id },
    { description: "Glass Partition - G1", quantity: 22, unit: "lm", unitRate: 310, amount: 6_820, projectId: docDemoProject.id },
    { description: "Suspended Ceiling - PB3", quantity: 310, unit: "m2", unitRate: 58, amount: 17_980, tenderId: docDemoTender.id },
  ];

  for (const item of demoEstimateLineItems) {
    const existing = await prisma.estimateLineItem.findFirst({
      where: {
        organisationId: org.id,
        description: item.description,
        projectId: item.projectId ?? null,
        tenderId: item.tenderId ?? null,
      },
    });
    if (existing) continue;
    await prisma.estimateLineItem.create({
      data: {
        organisationId: org.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitRate: item.unitRate,
        amount: item.amount,
        projectId: item.projectId,
        tenderId: item.tenderId,
        source: "zztakeoff",
      },
    });
  }

  // Project Financials & Invoice Review demo data (Phase 8) — suppliers, POs,
  // deliveries, a mix of supplier bills across the review pipeline (incl. one
  // in the Unallocated tray), and a Variation + Progress Claim wrapping
  // placeholder Phase 7 documents, so the Financials tab and Finance hub look
  // real on first run without needing a live mailbox or generated PDFs.
  console.log("Seeding Project Financials demo data...");

  await prisma.project.update({ where: { id: docDemoProject.id }, data: { costBudget: 740_000 } });

  const demoSuppliers = [
    { trade: "Aluminium", company: "Steel & Glass Co", email: "accounts@steelandglass.example" },
    { trade: "Hardware (Standard)", company: "BuildRight Hardware", email: "billing@buildright.example" },
  ];
  const supplierIdByCompany = new Map<string, string>();
  for (const s of demoSuppliers) {
    const existingSupplier = await prisma.supplier.findFirst({ where: { organisationId: org.id, company: s.company } });
    const supplier = existingSupplier
      ? await prisma.supplier.update({ where: { id: existingSupplier.id }, data: { trade: s.trade, email: s.email } })
      : await prisma.supplier.create({ data: { organisationId: org.id, trade: s.trade, company: s.company, email: s.email } });
    supplierIdByCompany.set(s.company, supplier.id);
  }
  const steelGlassId = supplierIdByCompany.get("Steel & Glass Co")!;
  const buildRightId = supplierIdByCompany.get("BuildRight Hardware")!;

  async function upsertPo(number: string, supplierId: string, value: number, status: string, expectedOffsetDays: number) {
    const existing = await prisma.purchaseOrder.findFirst({ where: { organisationId: org.id, projectId: docDemoProject.id, number } });
    const data = { organisationId: org.id, projectId: docDemoProject.id, supplierId, number, value, status, expectedDate: daysFromNow(expectedOffsetDays) };
    return existing ? prisma.purchaseOrder.update({ where: { id: existing.id }, data }) : prisma.purchaseOrder.create({ data });
  }
  const po1 = await upsertPo("PO-01", steelGlassId, 65_000, "Ordered", 14);
  const po2 = await upsertPo("PO-02", buildRightId, 22_000, "Delivered", -5);

  async function upsertDelivery(poId: string | null, supplierId: string | null, status: string, deliveredOffsetDays: number | null, description: string) {
    const existing = await prisma.delivery.findFirst({ where: { organisationId: org.id, projectId: docDemoProject.id, poId } });
    const data = {
      organisationId: org.id,
      projectId: docDemoProject.id,
      poId,
      supplierId,
      status,
      deliveredDate: deliveredOffsetDays != null ? daysFromNow(deliveredOffsetDays) : null,
      itemsJson: [{ description }],
    };
    return existing ? prisma.delivery.update({ where: { id: existing.id }, data }) : prisma.delivery.create({ data });
  }
  await upsertDelivery(po2.id, buildRightId, "Delivered", -3, "Door hardware sets");
  await upsertDelivery(null, null, "Pending", null, "Plasterboard sheets");

  // Phase 10 Foreman Mobile demo data — Frank Foreman assigned to Riverside
  // (docDemoProject, code P26-1001), with yesterday's update fully submitted
  // (crew + a task tick + an issue) so the Site updates/Issues tabs aren't
  // empty AND the mobile /site flow has something to suggest "yesterday's
  // crew" from. Today is deliberately left untouched — including the
  // "Plasterboard sheets" Pending delivery above — so the live demo shows
  // the foreman completing a real day's update from a blank slate.
  console.log("Seeding Foreman Mobile demo data...");
  const foremanUser = await prisma.user.findFirstOrThrow({
    where: { organisationId: org.id, email: "foreman@paracon.com.au" },
  });
  await prisma.project.update({ where: { id: docDemoProject.id }, data: { foremanUserId: foremanUser.id } });

  const carpentryActivity = await prisma.programActivity.findFirstOrThrow({
    where: { projectId: docDemoProject.id, name: "Carpentry fit-out" },
  });
  await prisma.dailySiteUpdate.deleteMany({ where: { organisationId: org.id, projectId: docDemoProject.id } });

  const CREW_NAMES = ["Marcus Webb", "Jacob Ferreira", "Tane Williams"];

  const yesterdayUpdate = await prisma.dailySiteUpdate.create({
    data: {
      organisationId: org.id,
      projectId: docDemoProject.id,
      foremanUserId: foremanUser.id,
      date: daysAgo(1),
      note: "Mild rain in the morning, cleared by 10am.",
      submittedAt: daysAgo(1),
    },
  });
  for (const workerName of CREW_NAMES) {
    const workerId = workerIdByName.get(workerName);
    if (!workerId) throw new Error(`Unknown demo worker "${workerName}"`);
    await prisma.attendance.create({ data: { dailySiteUpdateId: yesterdayUpdate.id, workerId, present: true, hours: 8 } });
  }
  await prisma.taskProgress.create({
    data: {
      dailySiteUpdateId: yesterdayUpdate.id,
      programActivityId: carpentryActivity.id,
      status: "On Track",
      note: "Framing progressing on Level 3.",
    },
  });
  await prisma.issue.create({
    data: {
      organisationId: org.id,
      projectId: docDemoProject.id,
      dailySiteUpdateId: yesterdayUpdate.id,
      raisedByUserId: foremanUser.id,
      description: "Service lift was out of action for ~2 hours this morning, delayed material movement.",
      severity: "Medium",
    },
  });

  async function placeholderBillFile(name: string) {
    const existing = await prisma.storedFile.findFirst({ where: { organisationId: org.id, name, projectId: docDemoProject.id } });
    if (existing) return existing;
    return prisma.storedFile.create({
      data: {
        organisationId: org.id,
        key: `seed/bills/${docDemoProject.id}/${name}`,
        name,
        mime: "application/pdf",
        size: 180_000,
        category: "Quotes & Purchase Orders",
        projectId: docDemoProject.id,
      },
    });
  }

  async function upsertBill(input: {
    invoiceNumber: string;
    projectId: string | null;
    supplierId: string | null;
    supplierNameRaw: string | null;
    poId: string | null;
    amountExGst: number;
    status: string;
    allocationStatus: string;
    jobNumberRaw: string | null;
    source: string;
    checklist: { orderedConfirmed: boolean; receivedConfirmed: boolean; quantityConfirmed: boolean; priceConfirmed: boolean };
  }) {
    const billFile = await placeholderBillFile(`${input.invoiceNumber}.pdf`);
    const gstAmount = Math.round(input.amountExGst * 0.1 * 100) / 100;
    const existing = await prisma.supplierBill.findFirst({ where: { organisationId: org.id, invoiceNumber: input.invoiceNumber } });
    const data = {
      organisationId: org.id,
      projectId: input.projectId,
      supplierId: input.supplierId,
      supplierNameRaw: input.supplierNameRaw,
      poId: input.poId,
      billFileId: billFile.id,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: daysAgo(10),
      amountExGst: input.amountExGst,
      gstAmount,
      amountIncGst: input.amountExGst + gstAmount,
      jobNumberRaw: input.jobNumberRaw,
      allocationStatus: input.allocationStatus,
      status: input.status,
      source: input.source,
      ...input.checklist,
    };
    return existing ? prisma.supplierBill.update({ where: { id: existing.id }, data }) : prisma.supplierBill.create({ data });
  }

  await upsertBill({
    invoiceNumber: "INV-3321",
    projectId: docDemoProject.id,
    supplierId: buildRightId,
    supplierNameRaw: null,
    poId: po2.id,
    amountExGst: 22_000,
    status: "Approved",
    allocationStatus: "Allocated",
    jobNumberRaw: docDemoProject.code,
    source: "Manual",
    checklist: { orderedConfirmed: true, receivedConfirmed: true, quantityConfirmed: true, priceConfirmed: true },
  });
  await upsertBill({
    invoiceNumber: "INV-5102",
    projectId: docDemoProject.id,
    supplierId: steelGlassId,
    supplierNameRaw: null,
    poId: po1.id,
    amountExGst: 30_000,
    status: "Under review",
    allocationStatus: "Allocated",
    jobNumberRaw: docDemoProject.code,
    source: "Email",
    checklist: { orderedConfirmed: true, receivedConfirmed: false, quantityConfirmed: false, priceConfirmed: false },
  });
  await upsertBill({
    invoiceNumber: "INV-9981",
    projectId: null,
    supplierId: null,
    supplierNameRaw: "Unknown Glazing Supplies",
    poId: null,
    amountExGst: 8_400,
    status: "Received",
    allocationStatus: "Unallocated",
    jobNumberRaw: null,
    source: "Email",
    checklist: { orderedConfirmed: false, receivedConfirmed: false, quantityConfirmed: false, priceConfirmed: false },
  });
  await upsertBill({
    invoiceNumber: "INV-2087",
    projectId: docDemoProject.id,
    supplierId: buildRightId,
    supplierNameRaw: null,
    poId: null,
    amountExGst: 12_000,
    status: "Reconciled",
    allocationStatus: "Allocated",
    jobNumberRaw: docDemoProject.code,
    source: "Manual",
    checklist: { orderedConfirmed: true, receivedConfirmed: true, quantityConfirmed: true, priceConfirmed: true },
  });

  // A placeholder Phase 7 GeneratedDocument pair (no PDF/XLSX bytes — same
  // convention as demoStoredFiles above) so the Variation + Progress Claim
  // commercial wrappers have something real to reference.
  const variationColors = defaultDocumentTemplateConfig("VARIATION").pdfColors;
  const orgLetterhead = { legalName: org.legalName!, abn: org.abn!, registeredAddress: org.registeredAddress!, logoUrl: org.logoUrl };

  const existingVariationDoc = await prisma.generatedDocument.findFirst({
    where: { organisationId: org.id, projectId: docDemoProject.id, type: "VARIATION", number: "VQ-01" },
  });
  const variationSnapshot: VariationSnapshot = {
    number: "VQ-01",
    version: 1,
    date: daysAgo(20).toISOString().slice(0, 10),
    attention: "Matthew Irvine",
    company: "Meridian Funds Management",
    cc: "",
    from: "Paracon Group Pty Ltd",
    projectName: docDemoProject.name,
    projectAddress: docDemoProject.address ?? "",
    introLine: "Please find below additional works undertaken outside of our contractual scope.",
    lineItems: [{ item: 1, description: "Additional glazing to level 2 lobby", amount: 18_500 }],
    totals: { totalExGst: 18_500, gst: 1_850, totalIncGst: 20_350 },
    validityDays: 7,
    signOffName: "Priya Manager",
    signOffRole: "Project Manager",
    signOffPhone: "",
    org: orgLetterhead,
    colors: variationColors,
  };
  const variationDoc = existingVariationDoc
    ? await prisma.generatedDocument.update({ where: { id: existingVariationDoc.id }, data: { dataSnapshotJson: variationSnapshot } })
    : await prisma.generatedDocument.create({
        data: {
          organisationId: org.id,
          type: "VARIATION",
          projectId: docDemoProject.id,
          number: "VQ-01",
          version: 1,
          dataSnapshotJson: variationSnapshot,
        },
      });

  await prisma.variation.upsert({
    where: { generatedDocumentId: variationDoc.id },
    update: { value: 18_500, status: "Approved" },
    create: {
      organisationId: org.id,
      projectId: docDemoProject.id,
      generatedDocumentId: variationDoc.id,
      number: "VQ-01",
      value: 18_500,
      status: "Approved",
      decidedAt: daysAgo(15),
    },
  });

  const claimedAmountExGst = 340_000;
  const { retentionThisClaim } = calcRetentionForClaim({
    claimAmountExGst: claimedAmountExGst,
    cumulativeRetentionHeldBefore: 0,
    contractValue: docDemoProject.value + 18_500,
    ratePct: 10,
    capPct: 5,
  });
  const progressClaimColors = defaultDocumentTemplateConfig("PROGRESS_CLAIM").pdfColors;
  const existingClaimDoc = await prisma.generatedDocument.findFirst({
    where: { organisationId: org.id, projectId: docDemoProject.id, type: "PROGRESS_CLAIM", number: "Claim #1" },
  });
  const progressClaimSnapshot: ProgressClaimSnapshot = {
    number: "Claim #1",
    version: 1,
    date: daysAgo(10).toISOString().slice(0, 10),
    projectName: docDemoProject.name,
    projectAddress: docDemoProject.address ?? "",
    contractWorkLines: [
      { name: "Partitions", percentCompleted: 40, contractValue: 510_000, previouslyClaimed: 0, valueToBeInvoiced: 204_000, thisClaim: 204_000 },
      { name: "Doors", percentCompleted: 40, contractValue: 145_000, previouslyClaimed: 0, valueToBeInvoiced: 58_000, thisClaim: 58_000 },
      { name: "Ceiling", percentCompleted: 40, contractValue: 195_000, previouslyClaimed: 0, valueToBeInvoiced: 78_000, thisClaim: 78_000 },
    ],
    variationLines: [],
    totals: {
      contractWork: { contractValue: 850_000, valueToBeInvoiced: 340_000, previouslyClaimed: 0, thisClaim: 340_000 },
      variations: { contractValue: 0, valueToBeInvoiced: 0, previouslyClaimed: 0, thisClaim: 0 },
      subtotalExGst: 340_000,
      gst: 34_000,
      totalIncGst: 374_000,
    },
    org: orgLetterhead,
    colors: progressClaimColors,
  };
  const claimDoc = existingClaimDoc
    ? await prisma.generatedDocument.update({ where: { id: existingClaimDoc.id }, data: { dataSnapshotJson: progressClaimSnapshot } })
    : await prisma.generatedDocument.create({
        data: {
          organisationId: org.id,
          type: "PROGRESS_CLAIM",
          projectId: docDemoProject.id,
          number: "Claim #1",
          version: 1,
          dataSnapshotJson: progressClaimSnapshot,
        },
      });

  await prisma.progressClaim.upsert({
    where: { generatedDocumentId: claimDoc.id },
    update: {},
    create: {
      organisationId: org.id,
      projectId: docDemoProject.id,
      generatedDocumentId: claimDoc.id,
      number: "Claim #1",
      claimedAmountExGst,
      claimedAmountIncGst: 374_000,
      retentionPct: 10,
      retentionHeld: retentionThisClaim,
      status: "Issued",
      issuedAt: daysAgo(10),
    },
  });

  // Phase 11 Productivity & Staff Scorecard demo data — recompute this
  // month's ProductivityRecord from the attendance/program data seeded
  // above, then give the two key-staff workers (Marcus Webb, Daniel Okafor)
  // a few months of StaffScore history so the trend isn't empty on first load.
  console.log("Seeding Productivity & Staff Scorecard demo data...");
  await recomputeProductivity(org.id, today);

  const directorUser = await prisma.user.findFirstOrThrow({
    where: { organisationId: org.id, email: "director@paracon.com.au" },
  });
  const scorecardConfig = await loadScorecardConfig(org.id);

  const KEY_STAFF_HISTORY: { workerName: string; monthsAgo: number; scores: Record<string, number>; locked: boolean }[] = [
    { workerName: "Marcus Webb", monthsAgo: 2, scores: { quality: 4.5, reliability: 4.5, productivity: 4, safety: 5 }, locked: true },
    { workerName: "Marcus Webb", monthsAgo: 1, scores: { quality: 4.5, reliability: 5, productivity: 4.5, safety: 5 }, locked: true },
    { workerName: "Marcus Webb", monthsAgo: 0, scores: { quality: 4.5, reliability: 5, productivity: 4.5, safety: 5 }, locked: false },
    { workerName: "Daniel Okafor", monthsAgo: 2, scores: { quality: 4, reliability: 3.5, productivity: 4, safety: 4 }, locked: true },
    { workerName: "Daniel Okafor", monthsAgo: 1, scores: { quality: 4.5, reliability: 4, productivity: 4.5, safety: 4.5 }, locked: true },
    { workerName: "Daniel Okafor", monthsAgo: 0, scores: { quality: 4.5, reliability: 4, productivity: 4.5, safety: 4.5 }, locked: false },
  ];

  for (const entry of KEY_STAFF_HISTORY) {
    const workerId = workerIdByName.get(entry.workerName);
    if (!workerId) throw new Error(`Unknown demo worker "${entry.workerName}"`);
    const period = startOfMonth(addMonths(today, -entry.monthsAgo));
    const overallScore = calcOverallScore(entry.scores, scorecardConfig.metrics);

    await prisma.staffScore.upsert({
      where: { organisationId_workerId_period: { organisationId: org.id, workerId, period } },
      update: { metricScoresJson: entry.scores, overallScore, assessedByUserId: directorUser.id, lockedAt: entry.locked ? daysAgo(1) : null },
      create: {
        organisationId: org.id,
        workerId,
        period,
        metricScoresJson: entry.scores,
        overallScore,
        assessedByUserId: directorUser.id,
        lockedAt: entry.locked ? daysAgo(1) : null,
      },
    });
  }

  // Platform org — hosts the Super Admin account, kept separate from any
  // tenant so "which org does this user belong to" never gets ambiguous
  // for someone with cross-tenant (platform.superadmin) access.
  console.log("Seeding Platform org + Super Admin...");

  const platformOrg = await prisma.organisation.upsert({
    where: { slug: "platform" },
    update: {},
    create: { name: "OneParacon Platform", slug: "platform" },
  });

  const superAdminRole = await prisma.role.upsert({
    where: { organisationId_slug: { organisationId: platformOrg.id, slug: "super-admin" } },
    update: {},
    create: {
      organisationId: platformOrg.id,
      name: "Super Admin",
      slug: "super-admin",
      isSystem: true,
    },
  });

  const superAdminPermission = await prisma.permission.findUniqueOrThrow({
    where: { slug: "platform.superadmin" },
  });
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: superAdminPermission.id } },
    update: {},
    create: { roleId: superAdminRole.id, permissionId: superAdminPermission.id },
  });

  await prisma.user.upsert({
    where: { organisationId_email: { organisationId: platformOrg.id, email: SUPER_ADMIN_EMAIL } },
    update: { roleId: superAdminRole.id },
    create: {
      organisationId: platformOrg.id,
      email: SUPER_ADMIN_EMAIL,
      name: "Platform Super Admin",
      hashedPassword,
      roleId: superAdminRole.id,
    },
  });

  console.log("Seed complete.");
  console.log("Demo logins (password: %s):", DEMO_PASSWORD);
  for (const user of DEMO_USERS) console.log(`  ${user.email} (${user.roleSlug})`);
  console.log(`  ${SUPER_ADMIN_EMAIL} (super-admin)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
