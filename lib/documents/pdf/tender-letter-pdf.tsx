import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { TenderLetterSnapshot } from "../types";
import { Letterhead, buildPdfStyles, money } from "./shared";

function Bullet({ text, styles }: { text: string; styles: ReturnType<typeof buildPdfStyles> }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

/**
 * Mirrors the real Tender Letter (master blank + Uni Lodge live instance):
 * date/company/address/contact -> project+address -> salutation -> TENDER
 * DOCUMENTATION -> TENDER PRICE (per-trade -> subtotal/GST/total) -> SCOPE OF
 * WORKS grouped by section (the checked scope-builder library renders as the
 * bullet list; no hidden boolean columns here, they're just not checked) ->
 * QUALIFICATIONS -> sign-off.
 */
function TenderLetterDocument({ snapshot }: { snapshot: TenderLetterSnapshot }) {
  const styles = buildPdfStyles(snapshot.colors);
  const partitionsAndDoors = snapshot.scopeLines.filter((l) => l.section === "Partitions & Doors");
  const ceiling = snapshot.scopeLines.filter((l) => l.section === "Ceiling");
  const firstName = snapshot.contactName.split(" ")[0] || snapshot.contactName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead org={snapshot.org} styles={styles} docTitle="Tender Letter" docNumber={snapshot.number} />

        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{snapshot.date}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Company</Text>
          <Text style={styles.value}>{snapshot.company}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{snapshot.companyAddress}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>
            {snapshot.contactName} &nbsp; {snapshot.contactEmail}
          </Text>
        </View>

        <View style={{ marginTop: 10, marginBottom: 10 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{snapshot.projectName}</Text>
          <Text style={{ fontSize: 10, color: snapshot.colors.muted, marginTop: 2 }}>{snapshot.projectAddress}</Text>
        </View>

        <Text style={{ fontSize: 10 }}>Dear {firstName},</Text>
        <Text style={{ fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
          We thank you for the opportunity to provide our tender for the above project, generally in accordance with
          the documentation provided.
        </Text>

        <Text style={styles.h2}>Tender Documentation</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Drawings</Text>
          <Text style={styles.value}>
            Documentation contained within Tender Request
            {snapshot.documentationReceivedDate ? ` (received ${snapshot.documentationReceivedDate})` : ""}
          </Text>
        </View>
        {snapshot.specifications ? (
          <View style={styles.row}>
            <Text style={styles.label}>Specifications</Text>
            <Text style={styles.value}>{snapshot.specifications}</Text>
          </View>
        ) : null}
        {snapshot.addendums ? (
          <View style={styles.row}>
            <Text style={styles.label}>Addendums</Text>
            <Text style={styles.value}>{snapshot.addendums}</Text>
          </View>
        ) : null}

        <Text style={styles.h2}>Tender Price</Text>
        <View style={styles.table}>
          {snapshot.tenderPrice.tradeLines.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>{line.name}</Text>
              <Text style={[styles.tableCell, { width: 90, textAlign: "right" }]}>${money(line.sellAmount)}</Text>
            </View>
          ))}
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { flex: 1 }]}>Subtotal (excl GST)</Text>
            <Text style={[styles.totalsLabel, { width: 90, textAlign: "right" }]}>
              ${money(snapshot.tenderPrice.subtotalExGst)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { flex: 1 }]}>GST</Text>
            <Text style={[styles.totalsLabel, { width: 90, textAlign: "right" }]}>${money(snapshot.tenderPrice.gst)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={[styles.totalsLabel, { flex: 1 }]}>Total (inc GST)</Text>
            <Text style={[styles.totalsLabel, { width: 90, textAlign: "right" }]}>
              ${money(snapshot.tenderPrice.totalIncGst)}
            </Text>
          </View>
        </View>

        <Text style={styles.h2}>Scope of Works</Text>
        {partitionsAndDoors.length > 0 && (
          <View>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 4 }}>Partitions & Doors</Text>
            {partitionsAndDoors.map((line, i) => (
              <Bullet key={i} text={line.code ? `${line.code} — ${line.label}` : line.label} styles={styles} />
            ))}
          </View>
        )}
        {ceiling.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 4 }}>Ceiling</Text>
            {ceiling.map((line, i) => (
              <Bullet key={i} text={line.code ? `${line.code} — ${line.label}` : line.label} styles={styles} />
            ))}
          </View>
        )}

        <Text style={styles.h2}>Qualifications</Text>
        {snapshot.qualifications.map((q, i) => (
          <Bullet key={i} text={q} styles={styles} />
        ))}

        <Text style={{ marginTop: 16, fontSize: 10 }}>
          We trust the above meets with your requirement and keenly await for further instructions.
        </Text>
        <Text style={{ marginTop: 12, fontSize: 10 }}>Yours sincerely,</Text>
        <Text style={{ marginTop: 10, fontFamily: "Helvetica-Bold", fontSize: 10 }}>{snapshot.signOffName}</Text>

        <FooterRevision number={snapshot.number} version={snapshot.version} styles={styles} />
      </Page>
    </Document>
  );
}

function FooterRevision({
  number,
  version,
  styles,
}: {
  number: string;
  version: number;
  styles: ReturnType<typeof buildPdfStyles>;
}) {
  return (
    <Text style={styles.footerNote}>
      {number} &nbsp;·&nbsp; Revision {version - 1}
    </Text>
  );
}

export async function renderTenderLetterPdf(snapshot: TenderLetterSnapshot): Promise<Buffer> {
  return renderToBuffer(<TenderLetterDocument snapshot={snapshot} />);
}
