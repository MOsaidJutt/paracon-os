/** One row of the prospects register, as the API returns it. */
export type ProspectRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  estimatedValue: number | null;
  stage: string;
  probability: number | null;
  nextAction: string | null;
  nextActionDate: string | null;
  notes: string | null;
  convertedTenderId: string | null;
  /**
   * The tender this prospect became, when it has been converted. Tender has no
   * code or number of its own yet (auto-numbering is document-level), so the
   * project name is the only human label available to link by.
   */
  convertedTender?: { id: string; projectName: string } | null;
  createdAt: string;
};
