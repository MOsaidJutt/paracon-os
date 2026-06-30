import { unstable_cache, revalidateTag } from "next/cache";
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

// Cache tag helpers — stable, unique per (org, key) or per platform key.
const cfgTag = (organisationId: string, key: string) => `cfg:${organisationId}:${key}`;
const platformCfgTag = (key: string) => `cfg:platform:${key}`;

/**
 * Resolves a single Config value with a 60-second server-side cache.
 * Cache is busted immediately when setOrgConfig / resetOrgConfig /
 * setPlatformConfig writes to the same key.
 *
 * Resolution order: org-specific override → platform default → throw.
 */
async function fetchConfigDirect<T>(key: string, organisationId: string): Promise<T> {
  const override = await prisma.config.findUnique({
    where: { organisationId_key: { organisationId, key } },
  });
  if (override) return override.valueJson as T;

  const platformDefault = await prisma.config.findFirst({
    where: { organisationId: null, key },
  });
  if (!platformDefault) throw new Error(`No Config row found for key "${key}"`);

  return platformDefault.valueJson as T;
}

/**
 * Resolves a single Config value with a 60-second server-side cache.
 * Cache is busted immediately when setOrgConfig / resetOrgConfig /
 * setPlatformConfig writes to the same key.
 *
 * Falls back to a direct DB call when running outside a Next.js request
 * context (seed scripts, tests, CLI tools) where unstable_cache is unavailable.
 */
export async function getConfig<T = unknown>(key: string, organisationId: string): Promise<T> {
  try {
    return await unstable_cache(
      () => fetchConfigDirect<T>(key, organisationId),
      [cfgTag(organisationId, key)],
      {
        revalidate: 60,
        tags: [cfgTag(organisationId, key), platformCfgTag(key)],
      }
    )();
  } catch (err) {
    // unstable_cache requires the Next.js incrementalCache context (a live
    // request). Seed scripts, tests and CLI tools run outside that context —
    // fall back to a direct DB call so those environments work normally.
    if (err instanceof Error && err.message.includes("incrementalCache")) {
      return fetchConfigDirect<T>(key, organisationId);
    }
    throw err;
  }
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

  // Bust cache immediately — config changes take effect on the next request.
  revalidateTag(cfgTag(organisationId, key));
}

export async function resetOrgConfig(organisationId: string, key: string): Promise<void> {
  await prisma.config.deleteMany({ where: { organisationId, key } });
  revalidateTag(cfgTag(organisationId, key));
}

export async function setPlatformConfig(key: string, valueJson: unknown, updatedBy: string): Promise<void> {
  const platformDefault = await prisma.config.findFirst({ where: { organisationId: null, key } });
  if (!platformDefault) throw new Error(`Unknown config key "${key}"`);

  await prisma.config.update({
    where: { id: platformDefault.id },
    data: { valueJson: valueJson as object, updatedBy },
  });

  // Bust all orgs' caches for this key — platform default affects every org
  // that doesn't have its own override.
  revalidateTag(platformCfgTag(key));
}
