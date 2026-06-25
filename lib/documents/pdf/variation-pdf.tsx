import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { VariationSnapshot } from "../types";
import { Letterhead, buildPdfStyles, money } from "./shared";

/** Mirrors Variation_Template_R2.xlsx field-for-field: date/attention/company/cc/from -> project+address -> Item|Description|$ -> Terms -> TOTAL (ex GST) -> sign-off. */
function VariationDocument({ snapshot }: { snapshot: VariationSnapshot }) {
  const styles = buildPdfStyles(snapshot.colors);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead org={snapshot.org} styles={styles} docTitle="Variation Quotation" docNumber={snapshot.number} />

        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{snapshot.date}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Attention</Text>
          <Text style={styles.value}>{snapshot.attention}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Company</Text>
          <Text style={styles.value}>{snapshot.company}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cc</Text>
          <Text style={styles.value}>{snapshot.cc}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>From</Text>
          <Text style={styles.value}>{snapshot.from}</Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{snapshot.projectName}</Text>
          <Text style={{ fontSize: 10, color: snapshot.colors.muted, marginTop: 2 }}>{snapshot.projectAddress}</Text>
        </View>

        <Text style={{ marginTop: 12, fontSize: 10, lineHeight: 1.4 }}>{snapshot.introLine}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: 32 }]}>Item</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Description</Text>
            <Text style={[styles.tableHeaderCell, { width: 80, textAlign: "right" }]}>$</Text>
          </View>
          {snapshot.lineItems.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: 32 }]}>{line.item}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{line.description}</Text>
              <Text style={[styles.tableCell, { width: 80, textAlign: "right" }]}>{money(line.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>Terms:</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4, marginTop: 3, color: snapshot.colors.muted }}>
            This variation is valid for {snapshot.validityDays} days from the date of issue, after which we reserve
            the right to revise the pricing if any changes arise that affect the cost, scope or delivery of the
            works, including altered site conditions, increases in material/labour costs, delays, additional
            directions or any other relevant factors.
          </Text>
        </View>

        <View style={styles.grandTotalRow}>
          <Text style={[styles.totalsLabel, { flex: 1 }]}>TOTAL (ex GST)</Text>
          <Text style={[styles.totalsLabel, { width: 80, textAlign: "right" }]}>${money(snapshot.totals.totalExGst)}</Text>
        </View>

        <Text style={{ marginTop: 16, fontSize: 10 }}>Should you have any queries, please feel free to contact the undersigned.</Text>
        <Text style={{ marginTop: 12, fontSize: 10 }}>Regards,</Text>
        <Text style={{ marginTop: 10, fontFamily: "Helvetica-Bold", fontSize: 10 }}>{snapshot.signOffName}</Text>
        <Text style={{ fontSize: 10 }}>{snapshot.signOffRole}</Text>
        <Text style={{ fontSize: 10 }}>{snapshot.signOffPhone}</Text>
      </Page>
    </Document>
  );
}

export async function renderVariationPdf(snapshot: VariationSnapshot): Promise<Buffer> {
  return renderToBuffer(<VariationDocument snapshot={snapshot} />);
}
