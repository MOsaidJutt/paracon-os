import { DocumentTemplatesEditor } from "@/components/document-templates/document-templates-editor";

export default function TenderTemplatesPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The scope-builder library, qualifications boilerplate and PDF colours used to generate the Tender
        Letter. Branding (logo/colours/fonts) is set once for the whole app on the{" "}
        <a href="/admin/branding" className="underline">
          Branding
        </a>{" "}
        screen.
      </p>
      <DocumentTemplatesEditor types={["TENDER_LETTER"]} />
    </div>
  );
}
