declare module "pdf-parse/lib/pdf-parse.js" {
  function PdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<{ text: string }>;
  export default PdfParse;
}
