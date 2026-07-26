import { PrismaClient } from "@prisma/client";
import { CONFIG_DEFAULTS } from "../lib/seed-data";

/**
 * Seeds ONLY the Config registry's platform defaults, using the same
 * upsert-by-find the full seed uses (the unique constraint on
 * (organisationId, key) doesn't hold for a null organisationId in SQL).
 *
 * Exists because `npm run db:seed` also resets demo data — it deleteMany's
 * allocations, worker skills, compliance and daily site updates before
 * rebuilding them. When a release only adds new Config keys, that reset is
 * both unnecessary and destructive to whatever a demo tenant has entered by
 * hand. Run this instead; it touches nothing but the Config table.
 */
const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

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
      updated += 1;
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
        },
      });
      created += 1;
      console.log(`  + ${def.key}`);
    }
  }

  console.log(`Config defaults: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
