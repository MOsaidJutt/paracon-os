import { DocumentTemplatesEditor } from "@/components/admin/document-templates/document-templates-editor";

export default function AdminDocumentTemplatesPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The scope-builder library, qualifications boilerplate and PDF colours used to generate Tender Letters,
        Variations and Progress Claims — config, not code. Numbering prefixes, GST rate, margin and rounding
        rules live on the regular{" "}
        <a href="/admin/settings" className="underline">
          Settings
        </a>{" "}
        screen.
      </p>
      <DocumentTemplatesEditor />
    </div>
  );
}
