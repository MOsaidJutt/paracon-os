import { describe, expect, it } from "vitest";
import { mapContactsRows } from "@/lib/import/importers/contacts";

const CLIENT_COLUMN_MAP = { name: "Client", status: "Status", address: "Address", contactName: "Contact", email: "Email", phone: "Phone" };
const SUPPLIER_COLUMN_MAP = { name: "Company", trade: "Trade", contactName: "Contact", email: "Email", phone: "Phone" };

describe("mapContactsRows — clients", () => {
  it("classifies a name not in existingKeys as create, and one that is as update", () => {
    const rows = mapContactsRows(
      [
        { Client: "New Co", Status: "Active" },
        { Client: "Existing Co", Status: "Active" },
      ],
      CLIENT_COLUMN_MAP,
      "client",
      new Set(["existing co"])
    );
    expect(rows[0]).toMatchObject({ action: "create", name: "New Co" });
    expect(rows[1]).toMatchObject({ action: "update", name: "Existing Co" });
  });

  it("matches existing keys case-insensitively (normalised)", () => {
    const [row] = mapContactsRows([{ Client: "EXISTING CO" }], CLIENT_COLUMN_MAP, "client", new Set(["existing co"]));
    expect(row.action).toBe("update");
  });

  it("skips a row with no name rather than silently dropping it", () => {
    const [row] = mapContactsRows([{ Client: null }], CLIENT_COLUMN_MAP, "client", new Set());
    expect(row.action).toBe("skip");
    expect(row.warnings).toContain("Missing name/company — row skipped.");
  });

  it("numbers rows starting from 2 (header is row 1)", () => {
    const rows = mapContactsRows(
      [{ Client: "A" }, { Client: "B" }],
      CLIENT_COLUMN_MAP,
      "client",
      new Set()
    );
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });
});

describe("mapContactsRows — suppliers", () => {
  it("requires a trade — missing trade skips the row even with a valid company", () => {
    const [row] = mapContactsRows([{ Company: "Acme Partitions", Trade: null }], SUPPLIER_COLUMN_MAP, "supplier", new Set());
    expect(row.action).toBe("skip");
    expect(row.warnings).toContain("Missing trade — row skipped.");
  });

  it("matches existing suppliers on the company|contact compound key", () => {
    const rows = mapContactsRows(
      [
        { Company: "Acme Partitions", Trade: "Partitions", Contact: "Jane" },
        { Company: "Acme Partitions", Trade: "Partitions", Contact: "Someone Else" },
      ],
      SUPPLIER_COLUMN_MAP,
      "supplier",
      new Set(["acme partitions|jane"])
    );
    expect(rows[0].action).toBe("update");
    expect(rows[1].action).toBe("create");
  });

  it("leaves optional fields null when the column map doesn't include them", () => {
    const [row] = mapContactsRows(
      [{ Company: "Acme", Trade: "Partitions" }],
      { name: "Company", trade: "Trade" },
      "supplier",
      new Set()
    );
    expect(row.email).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.comments).toBeNull();
  });
});
