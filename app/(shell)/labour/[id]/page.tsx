import { WorkerProfile } from "@/components/labour/worker-profile";

export default function WorkerProfilePage({ params }: { params: { id: string } }) {
  return <WorkerProfile workerId={params.id} />;
}
