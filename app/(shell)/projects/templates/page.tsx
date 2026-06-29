import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DocumentTemplatesEditor } from "@/components/document-templates/document-templates-editor";

export default async function ProjectTemplatesPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("doc.edit")) redirect("/projects");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The PDF colours used to generate Variations and Progress Claims. Branding (logo/colours/fonts) is
        set once for the whole app on the{" "}
        <a href="/admin/branding" className="underline">
          Branding
        </a>{" "}
        screen.
      </p>
      <DocumentTemplatesEditor types={["VARIATION", "PROGRESS_CLAIM"]} />
    </div>
  );
}
