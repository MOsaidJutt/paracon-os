import { auth } from "@/lib/auth";
import { getViewMode } from "@/lib/view-mode";
import { ProjectDetail } from "@/components/projects/project-detail";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const viewMode = session ? await getViewMode(session.user.organisationId, session.user.id) : "FULL";

  return <ProjectDetail projectId={params.id} viewMode={viewMode} />;
}
