import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt } from "../lib/crypto";
import { PERMISSION_GROUPS } from "../lib/permissions";
import { PERMISSION_LABELS, ROLE_DEFINITIONS, MODULES, CONFIG_DEFAULTS } from "../lib/seed-data";

const prisma = new PrismaClient();

const DEMO_USERS = [
  { email: "director@paracon.com.au", name: "Avery Director", roleSlug: "director" },
  { email: "pm@paracon.com.au", name: "Priya Manager", roleSlug: "project-manager" },
  { email: "foreman@paracon.com.au", name: "Frank Foreman", roleSlug: "site-foreman" },
  { email: "estimator@paracon.com.au", name: "Elliot Estimator", roleSlug: "estimator" },
] as const;

const DEMO_PASSWORD = "Demo1234!";

const SUPER_ADMIN_EMAIL = "superadmin@paracon-os.com";

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

  // Platform org — hosts the Super Admin account, kept separate from any
  // tenant so "which org does this user belong to" never gets ambiguous
  // for someone with cross-tenant (platform.superadmin) access.
  console.log("Seeding Platform org + Super Admin...");

  const platformOrg = await prisma.organisation.upsert({
    where: { slug: "platform" },
    update: {},
    create: { name: "Paracon OS Platform", slug: "platform" },
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
