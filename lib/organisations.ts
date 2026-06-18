import { prisma } from "./prisma";
import { PERMISSION_GROUPS } from "./permissions";
import { PERMISSION_LABELS, ROLE_DEFINITIONS, MODULES } from "./seed-data";

/** Upserts the full permission catalogue. Idempotent — safe to call on every provision. */
export async function ensurePermissionsSeeded(): Promise<void> {
  for (const slug of Object.values(PERMISSION_GROUPS).flat()) {
    const group = slug.split(".")[0];
    await prisma.permission.upsert({
      where: { slug },
      update: {},
      create: { slug, group, label: PERMISSION_LABELS[slug] ?? slug },
    });
  }
}

/**
 * Creates a brand-new tenant with the standard system roles, permissions
 * and modules — the same shape `prisma/seed.ts` gives Paracon Group, so a
 * Super Admin-created org and the seeded demo org are never structurally
 * different. Does not create any users; the caller sends a Director invite.
 */
export async function provisionOrganisation(input: {
  name: string;
  slug: string;
}): Promise<{ organisationId: string; directorRoleId: string }> {
  await ensurePermissionsSeeded();

  const organisation = await prisma.organisation.create({
    data: { name: input.name, slug: input.slug },
  });

  let directorRoleId: string | null = null;
  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.create({
      data: {
        organisationId: organisation.id,
        name: def.name,
        slug: def.slug,
        isSystem: true,
      },
    });
    if (def.slug === "director") directorRoleId = role.id;

    for (const permSlug of def.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { slug: permSlug } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
  }
  if (!directorRoleId) throw new Error("Director role definition missing from ROLE_DEFINITIONS");

  for (const mod of MODULES) {
    const moduleRow = await prisma.module.upsert({
      where: { slug: mod.slug },
      update: { label: mod.label, description: mod.description },
      create: { ...mod, isSystem: true },
    });
    await prisma.organisationModule.create({
      data: { organisationId: organisation.id, moduleId: moduleRow.id, enabled: true },
    });
  }

  return { organisationId: organisation.id, directorRoleId };
}
