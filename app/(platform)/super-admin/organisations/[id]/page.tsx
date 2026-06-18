import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrganisationDetail } from "@/components/super-admin/organisation-detail";

export default async function SuperAdminOrganisationPage({ params }: { params: { id: string } }) {
  const organisation = await prisma.organisation.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  if (!organisation) notFound();

  return <OrganisationDetail organisation={organisation} />;
}
