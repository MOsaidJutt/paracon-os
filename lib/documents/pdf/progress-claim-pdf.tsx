import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ProgressClaimLineResult } from "../progress-claim-calc";
import type { ProgressClaimSnapshot } from "../types";
import { Letterhead, buildPdfStyles, money } from "./shared";

function LineRow({ line, styles }: { line: ProgressClaimLineResult; styles: ReturnType<typeof buildPdfStyles> }) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 1 }]}>{line.name}</Text>
      <Text style={[styles.tableCell, { width: 56, textAlign: "right" }]}>{line.percentCompleted}%</Text>
      <Text style={[styles.tableCell, { width: 72, textAlign: "right" }]}>{money(line.contractValue)}</Text>
      <Text style={[styles.tableCell, { width: 72, textAlign: "right" }]}>{money(line.valueToBeInvoiced)}</Text>
      <Text style={[styles.tableCell, { width: 72, textAlign: "right" }]}>{money(line.previouslyClaimed)}</Text>
      <Text style={[styles.tableCell, { width: 72, textAlign: "right" }]}>{money(line.thisClaim)}</Text>
    </View>
  );
}

function SubtotalRow({
  label,
  subtotal,
  styles,
}: {
  label: string;
  subtotal: { contractValue: number; valueToBeInvoiced: number; previouslyClaimed: number; thisClaim: number };
  styles: ReturnType<typeof buildPdfStyles>;
}) {
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, { flex: 1 }]}>{label}</Text>
      <Text style={{ width: 56 }} />
      <Text style={[styles.totalsLabel, { width: 72, textAlign: "right" }]}>{money(subtotal.contractValue)}</Text>
      <Text style={[styles.totalsLabel, { width: 72, textAlign: "right" }]}>{money(subtotal.valueToBeInvoiced)}</Text>
      <Text style={[styles.totalsLabel, { width: 72, textAlign: "right" }]}>{money(subtotal.previouslyClaimed)}</Text>
      <Text style={[styles.totalsLabel, { width: 72, textAlign: "right" }]}>{money(subtotal.thisClaim)}</Text>
    </View>
  );
}

/** Mirrors Invoice Proforma Template.xlsx: Description|%Completed|Contract Value|Value To Be Invoiced|Previously Claimed|This Claim, CONTRACT WORK + VARIATIONS sections, then Subtotal/GST/Total. */
function ProgressClaimDocument({ snapshot }: { snapshot: ProgressClaimSnapshot }) {
  const styles = buildPdfStyles(snapshot.colors);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead org={snapshot.org} styles={styles} docTitle={`Progress Claim ${snapshot.number}`} docNumber={snapshot.date} />

        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{snapshot.projectName}</Text>
          <Text style={{ fontSize: 10, color: snapshot.colors.muted, marginTop: 2 }}>{snapshot.projectAddress}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Description</Text>
            <Text style={[styles.tableHeaderCell, { width: 56, textAlign: "right" }]}>% Complete</Text>
            <Text style={[styles.tableHeaderCell, { width: 72, textAlign: "right" }]}>Contract Value</Text>
            <Text style={[styles.tableHeaderCell, { width: 72, textAlign: "right" }]}>Value To Invoice</Text>
            <Text style={[styles.tableHeaderCell, { width: 72, textAlign: "right" }]}>Prev. Claimed</Text>
            <Text style={[styles.tableHeaderCell, { width: 72, textAlign: "right" }]}>This Claim</Text>
          </View>

          <Text style={styles.h2}>Contract Work</Text>
          {snapshot.contractWorkLines.map((line, i) => (
            <LineRow key={i} line={line} styles={styles} />
          ))}
          <SubtotalRow label="Subtotal" subtotal={snapshot.totals.contractWork} styles={styles} />

          <Text style={styles.h2}>Variations</Text>
          {snapshot.variationLines.length === 0 ? (
            <Text style={{ fontSize: 9, color: snapshot.colors.muted, paddingHorizontal: 4, paddingVertical: 4 }}>
              No variations on this claim.
            </Text>
          ) : (
            snapshot.variationLines.map((line, i) => <LineRow key={i} line={line} styles={styles} />)
          )}
          <SubtotalRow label="Subtotal" subtotal={snapshot.totals.variations} styles={styles} />
        </View>

        <View style={{ marginTop: 10 }}>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { flex: 1 }]}>Subtotal (ex GST)</Text>
            <Text style={[styles.totalsLabel, { width: 72, textAlign: "right" }]}>${money(snapshot.totals.subtotalExGst)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { flex: 1 }]}>GST</Text>
            <Text style={[styles.totalsLabel, { width: 72, textAlign: "right" }]}>${money(snapshot.totals.gst)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={[styles.totalsLabel, { flex: 1 }]}>Total (inc GST)</Text>
            <Text style={[styles.totalsLabel, { width: 72, textAlign: "right" }]}>${money(snapshot.totals.totalIncGst)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderProgressClaimPdf(snapshot: ProgressClaimSnapshot): Promise<Buffer> {
  return renderToBuffer(<ProgressClaimDocument snapshot={snapshot} />);
}
