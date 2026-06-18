import { prisma } from "./prisma";
import { NotFoundError } from "./errors";

export type ModuleStatus = {
  id: string;
  slug: string;
  label: string;
  description: string;
  enabled: boolean;
};

/** All modules with their enabled/disabled status for a given org. */
export async function listModulesForOrg(organisationId: string): Promise<ModuleStatus[]> {
  const modules = await prisma.module.findMany({
    orderBy: { sortOrder: "asc" },
    include: { organisationModules: { where: { organisationId } } },
  });

  return modules.map((module) => ({
    id: module.id,
    slug: module.slug,
    label: module.label,
    description: module.description,
    enabled: module.organisationModules[0]?.enabled ?? module.enabledByDefault,
  }));
}

export async function getEnabledModuleSlugs(organisationId: string): Promise<string[]> {
  const modules = await listModulesForOrg(organisationId);
  return modules.filter((m) => m.enabled).map((m) => m.slug);
}

/**
 * Call from a module's route group layout once Phase 2+ builds real module
 * pages — throws NotFoundError (mapped to a 404, not 403, per the
 * don't-confirm-existence rule) if the org has the module turned off.
 */
export async function requireModuleEnabled(slug: string, organisationId: string): Promise<void> {
  const modules = await listModulesForOrg(organisationId);
  const target = modules.find((m) => m.slug === slug);
  if (!target || !target.enabled) throw new NotFoundError();
}

export async function setModuleEnabled(
  organisationId: string,
  moduleId: string,
  enabled: boolean
): Promise<void> {
  await prisma.organisationModule.upsert({
    where: { organisationId_moduleId: { organisationId, moduleId } },
    update: { enabled },
    create: { organisationId, moduleId, enabled },
  });
}
