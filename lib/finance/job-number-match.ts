// Pure, rule-based matching — no AI extractor here, per the build brief.
// Two passes: (1) prefer a structured "label: value" extraction block (the
// shape EzzyBills' own processed output takes when it appears in the inbox),
// (2) otherwise a plain regex scan for the P##-#### job-number pattern across
// subject/body/filename/PDF-text-layer. Exactly one distinct match against a
// real project code is "high" confidence and auto-allocates; anything else
// (none, or several different candidates) is "low" confidence and lands in
// the Unallocated tray for a human to resolve in one click.

const JOB_NUMBER_PATTERN = /P\d{2}-\d{4}/gi;

export function extractJobNumberCandidates(text: string): string[] {
  const matches = text.toUpperCase().match(JOB_NUMBER_PATTERN) ?? [];
  return Array.from(new Set(matches));
}

export type EzzyBillsExtractedFields = {
  jobNumber?: string;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
};

const LABEL_PATTERNS: { field: keyof EzzyBillsExtractedFields; pattern: RegExp }[] = [
  { field: "jobNumber", pattern: /(?:job|project|reference|po)\s*(?:number|no\.?|#)?\s*[:\-]\s*([A-Za-z0-9-]+)/i },
  { field: "supplierName", pattern: /supplier\s*(?:name)?\s*[:\-]\s*(.+)/i },
  { field: "invoiceNumber", pattern: /invoice\s*(?:number|no\.?|#)\s*[:\-]\s*([A-Za-z0-9-]+)/i },
  { field: "invoiceDate", pattern: /invoice\s*date\s*[:\-]\s*([0-9/.\-]+)/i },
  { field: "totalAmount", pattern: /total\s*(?:amount|due|\(inc\s*gst\))?\s*[:\-]\s*\$?\s*([0-9,]+\.?[0-9]*)/i },
];

/**
 * Parses a loosely-structured "label: value" block — the shape an EzzyBills
 * extraction notification typically takes. Returns null if nothing
 * recognisable was found, so the caller falls back to the plain regex scan.
 */
export function parseStructuredBillFields(text: string): EzzyBillsExtractedFields | null {
  const result: EzzyBillsExtractedFields = {};
  for (const line of text.split(/\r?\n/)) {
    for (const { field, pattern } of LABEL_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;
      if (field === "totalAmount") {
        result.totalAmount = Number(match[1].replace(/,/g, ""));
      } else {
        (result as Record<string, string | undefined>)[field] = match[1].trim();
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export type JobNumberMatch = {
  jobNumberRaw: string | null; // first raw candidate found, regardless of whether it resolved to a real project
  matchedProjectCode: string | null; // set only when exactly one distinct candidate matches an existing project code
  confidence: "high" | "low";
  source: "ezzybills" | "regex" | "none";
};

export function resolveJobNumberMatch(input: {
  structured: EzzyBillsExtractedFields | null;
  rawTexts: string[];
  existingProjectCodes: string[];
}): JobNumberMatch {
  const codesUpper = new Set(input.existingProjectCodes.map((c) => c.toUpperCase()));

  if (input.structured?.jobNumber) {
    const candidate = input.structured.jobNumber.toUpperCase();
    if (codesUpper.has(candidate)) {
      return { jobNumberRaw: input.structured.jobNumber, matchedProjectCode: candidate, confidence: "high", source: "ezzybills" };
    }
    return { jobNumberRaw: input.structured.jobNumber, matchedProjectCode: null, confidence: "low", source: "ezzybills" };
  }

  const allCandidates = Array.from(new Set(input.rawTexts.flatMap(extractJobNumberCandidates)));
  if (allCandidates.length === 0) {
    return { jobNumberRaw: null, matchedProjectCode: null, confidence: "low", source: "none" };
  }

  const matchingExisting = allCandidates.filter((c) => codesUpper.has(c));
  if (matchingExisting.length === 1) {
    return { jobNumberRaw: matchingExisting[0], matchedProjectCode: matchingExisting[0], confidence: "high", source: "regex" };
  }

  // Zero or multiple distinct matches against real projects -> low confidence, routed to the Unallocated tray.
  return { jobNumberRaw: allCandidates[0], matchedProjectCode: null, confidence: "low", source: "regex" };
}
