import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt } from "../lib/crypto";
import { PERMISSION_GROUPS } from "../lib/permissions";
import { PERMISSION_LABELS, ROLE_DEFINITIONS, MODULES, CONFIG_DEFAULTS } from "../lib/seed-data";
import { computeComplianceStatus } from "../lib/labour/compliance";

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
    update: {},
    create: {
      name: "Paracon Group",
      slug: "paracon",
      primaryColor: "#B08D57",
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
