import { prisma } from "./prisma";
import { BadRequestError } from "./errors";

export type ConfigEntry = {
  key: string;
  group: string;
  type: "LIST" | "NUMBER" | "WEIGHTS" | "BANDS" | "TEXT" | "METRICS";
  label: string;
  description: string;
  value: unknown;
  isOverridden: boolean;
};

/**
 * Resolves a single Config value: org-specific override if one exists,
 * else the platform default (organisationId: null) row. Mirrors
 * lib/ai.ts's resolveAiSetting FEATURE -> ORG -> GLOBAL resolution.
 */
export async function getConfig<T = unknown>(key: string, organisationId: string): Promise<T> {
  const override = await prisma.config.findUnique({ where: { organisationId_key: { organisationId, key } } });
  if (override) return override.valueJson as T;

  const platformDefault = await prisma.config.findFirst({ where: { organisationId: null, key } });
  if (!platformDefault) throw new Error(`No Config row found for key "${key}"`);

  return platformDefault.valueJson as T;
}

/** Shared by every feature's Config-backed validation: asserts a free-text value is one of the allowed options. */
export function assertInList(value: string, list: string[], field: string): void {
  if (!list.includes(value)) {
    throw new BadRequestError(`Invalid ${field} "${value}". Must be one of: ${list.join(", ")}`);
  }
}

/** All platform-default keys, each annotated with this org's override (if any). Powers the admin UI. */
export async function listConfigsForOrg(organisationId: string): Promise<ConfigEntry[]> {
  const [defaults, overrides] = await Promise.all([
    prisma.config.findMany({ where: { organisationId: null }, orderBy: [{ group: "asc" }, { label: "asc" }] }),
    prisma.config.findMany({ where: { organisationId } }),
  ]);
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

  return defaults.map((def) => {
    const override = overrideByKey.get(def.key);
    return {
      key: def.key,
      group: def.group,
      type: def.type,
      label: def.label,
      description: def.description,
      value: override ? override.valueJson : def.valueJson,
      isOverridden: !!override,
    };
  });
}

/** All platform-default keys as-is, for the Super Admin settings screen. */
export async function listPlatformConfigs(): Promise<ConfigEntry[]> {
  const defaults = await prisma.config.findMany({
    where: { organisationId: null },
    orderBy: [{ group: "asc" }, { label: "asc" }],
  });
  return defaults.map((def) => ({
    key: def.key,
    group: def.group,
    type: def.type,
    label: def.label,
    description: def.description,
    value: def.valueJson,
    isOverridden: false,
  }));
}

export async function setOrgConfig(
  organisationId: string,
  key: string,
  valueJson: unknown,
  updatedBy: string
): Promise<void> {
  const platformDefault = await prisma.config.findFirst({ where: { organisationId: null, key } });
  if (!platformDefault) throw new Error(`Unknown config key "${key}"`);

  await prisma.config.upsert({
    where: { organisationId_key: { organisationId, key } },
    update: { valueJson: valueJson as object, updatedBy },
    create: {
      organisationId,
      key,
      group: platformDefault.group,
      type: platformDefault.type,
      label: platformDefault.label,
      description: platformDefault.description,
      isSystem: true,
      valueJson: valueJson as object,
      updatedBy,
    },
  });
}

export async function resetOrgConfig(organisationId: string, key: string): Promise<void> {
  await prisma.config.deleteMany({ where: { organisationId, key } });
}

export async function setPlatformConfig(key: string, valueJson: unknown, updatedBy: string): Promise<void> {
  const platformDefault = await prisma.config.findFirst({ where: { organisationId: null, key } });
  if (!platformDefault) throw new Error(`Unknown config key "${key}"`);

  await prisma.config.update({
    where: { id: platformDefault.id },
    data: { valueJson: valueJson as object, updatedBy },
  });
}
