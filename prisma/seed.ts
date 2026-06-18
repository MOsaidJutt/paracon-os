import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt } from "../lib/crypto";
import { PERMISSION_GROUPS } from "../lib/permissions";

const prisma = new PrismaClient();

const PERMISSION_LABELS: Record<string, string> = {
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
  "ai.assistant.use": "Use AI assistant",
  "platform.superadmin": "Super admin (all tenants)",
};

const ROLE_DEFINITIONS = [
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

const DEMO_USERS = [
  { email: "director@paracon.com.au", name: "Avery Director", roleSlug: "director" },
  { email: "pm@paracon.com.au", name: "Priya Manager", roleSlug: "project-manager" },
  { email: "foreman@paracon.com.au", name: "Frank Foreman", roleSlug: "site-foreman" },
  { email: "estimator@paracon.com.au", name: "Elliot Estimator", roleSlug: "estimator" },
] as const;

const DEMO_PASSWORD = "Demo1234!";

const MODULES = [
  { slug: "tender", label: "Tender Pipeline", description: "Tender register and pipeline KPIs" },
  { slug: "projects", label: "Projects & Program", description: "Project register and construction program" },
  { slug: "labour", label: "Labour Intelligence", description: "Worker database and skills matrix" },
  { slug: "forecast", label: "Forecast & Capacity", description: "Labour demand/supply forecast engine" },
  { slug: "allocation", label: "Resource Allocation", description: "Worker allocation planner" },
  { slug: "site-updates", label: "Site Daily Updates", description: "Foreman mobile daily update flow" },
  { slug: "productivity", label: "Productivity & Estimating", description: "Productivity DB and estimating feedback loop" },
] as const;

async function main() {
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

  // Permissions
  for (const slug of Object.values(PERMISSION_GROUPS).flat()) {
    const group = slug.split(".")[0];
    await prisma.permission.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        group,
        label: PERMISSION_LABELS[slug] ?? slug,
      },
    });
  }

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
    const module = await prisma.module.upsert({
      where: { slug: mod.slug },
      update: { label: mod.label, description: mod.description },
      create: { ...mod, isSystem: true },
    });
    await prisma.organisationModule.upsert({
      where: { organisationId_moduleId: { organisationId: org.id, moduleId: module.id } },
      update: { enabled: true },
      create: { organisationId: org.id, moduleId: module.id, enabled: true },
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

  console.log("Seed complete.");
  console.log("Demo logins (password: %s):", DEMO_PASSWORD);
  for (const user of DEMO_USERS) console.log(`  ${user.email} (${user.roleSlug})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
