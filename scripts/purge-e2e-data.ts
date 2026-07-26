import { PrismaClient } from "@prisma/client";

/**
 * Deletes the throwaway records the Playwright suite creates.
 *
 * tests/e2e/helpers/entities.ts builds a fresh client + project (and sometimes
 * a tender) per run rather than attaching test data to the seeded demo records,
 * which is the right call — but nothing removes them afterwards, so they
 * accumulate in whatever database the suite ran against. On a shared demo
 * database they end up on the dashboard next to real projects, and they skew
 * every count that reads "x of y projects".
 *
 * Only rows whose name starts with the helper's "E2E " prefix are touched, so
 * this can never reach a real client, project or tender. Cascades handle the
 * children (activities, allocations, milestones, issues).
 */
const prisma = new PrismaClient();
const PREFIX = "E2E ";

async function main() {
  const dryRun = !process.argv.includes("--commit");

  const [projects, tenders, clients] = await Promise.all([
    prisma.project.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true, name: true, code: true } }),
    prisma.tender.findMany({ where: { projectName: { startsWith: PREFIX } }, select: { id: true, projectName: true } }),
    prisma.client.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true, name: true } }),
  ]);

  console.log(`Projects to delete: ${projects.length}`);
  for (const p of projects) console.log(`  ${p.code}  ${p.name}`);
  console.log(`Tenders to delete : ${tenders.length}`);
  for (const t of tenders) console.log(`  ${t.projectName}`);
  console.log(`Clients to delete : ${clients.length}`);
  for (const c of clients) console.log(`  ${c.name}`);

  if (dryRun) {
    console.log("\nDry run. Re-run with --commit to delete.");
    return;
  }

  // Projects and tenders first: a client can't be removed while either still
  // references it.
  const deletedProjects = await prisma.project.deleteMany({ where: { name: { startsWith: PREFIX } } });
  const deletedTenders = await prisma.tender.deleteMany({ where: { projectName: { startsWith: PREFIX } } });
  const deletedClients = await prisma.client.deleteMany({ where: { name: { startsWith: PREFIX } } });

  console.log(
    `\nDeleted ${deletedProjects.count} projects, ${deletedTenders.count} tenders, ${deletedClients.count} clients.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
