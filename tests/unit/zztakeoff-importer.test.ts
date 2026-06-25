import { describe, expect, it } from "vitest";
import { mapRows } from "@/lib/import/importers/zztakeoff";

const COLUMN_MAP = {
  description: "Description",
  quantity: "Quantity",
  unit: "UoM",
  unitRate: "Unit rate",
  amount: "Amount",
  remarks: "Remarks",
};

describe("mapRows", () => {
  it("maps a fully-populated row with no warnings", () => {
    const [row] = mapRows(
      [{ Description: "Solid Partition - P1", Quantity: 84, UoM: "lm", "Unit rate": 145, Amount: 12180, Remarks: "Level 3" }],
      COLUMN_MAP
    );
    expect(row).toMatchObject({
      rowNumber: 2,
      description: "Solid Partition - P1",
      quantity: 84,
      unit: "lm",
      unitRate: 145,
      amount: 12180,
      remarks: "Level 3",
      warnings: [],
    });
  });

  it("flags a missing description, quantity or unit instead of silently dropping the row", () => {
    const [row] = mapRows([{ Description: null, Quantity: null, UoM: null }], COLUMN_MAP);
    expect(row.warnings).toEqual([
      "Missing description.",
      "Missing or non-numeric quantity.",
      "Missing unit of measure.",
    ]);
  });

  it("treats a non-numeric quantity as missing rather than NaN", () => {
    const [row] = mapRows([{ Description: "Item", Quantity: "n/a", UoM: "lm" }], COLUMN_MAP);
    expect(row.quantity).toBeNull();
    expect(row.warnings).toContain("Missing or non-numeric quantity.");
  });

  it("leaves optional columns null when the column map doesn't include them", () => {
    const [row] = mapRows(
      [{ Description: "Item", Quantity: 5, UoM: "m2" }],
      { description: "Description", quantity: "Quantity", unit: "UoM" }
    );
    expect(row.unitRate).toBeNull();
    expect(row.amount).toBeNull();
    expect(row.remarks).toBeNull();
    expect(row.warnings).toEqual([]);
  });

  it("numbers rows starting from 2 (header is row 1)", () => {
    const rows = mapRows(
      [
        { Description: "A", Quantity: 1, UoM: "ea" },
        { Description: "B", Quantity: 2, UoM: "ea" },
      ],
      COLUMN_MAP
    );
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });
});
