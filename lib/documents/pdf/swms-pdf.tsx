import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { SwmsSnapshot } from "../types";
import { Letterhead, buildPdfStyles } from "./shared";

const RISK_COLOR: Record<SwmsSnapshot["hazardLines"][number]["riskRating"], string> = {
  Low: "#2E7D32",
  Medium: "#ED9B11",
  High: "#C62828",
};

function Bullet({ text, styles }: { text: string; styles: ReturnType<typeof buildPdfStyles> }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

/**
 * General Fitout SWMS: letterhead -> project/client/PM/site manager details
 * (auto-filled — never re-keyed, CLAUDE.md rule 12) -> activity description
 * -> hazard identification table (activity / hazard / risk / control
 * measures, risk colour-coded per the RAG palette) -> required PPE -> sign-off.
 */
function SwmsDocument({ snapshot }: { snapshot: SwmsSnapshot }) {
  const styles = buildPdfStyles(snapshot.colors);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead org={snapshot.org} styles={styles} docTitle="Safe Work Method Statement" docNumber={snapshot.number} />

        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{snapshot.date}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Project</Text>
          <Text style={styles.value}>{snapshot.projectName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{snapshot.projectAddress}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Client</Text>
          <Text style={styles.value}>{snapshot.client}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Project Manager</Text>
          <Text style={styles.value}>{snapshot.pmName ?? "Not yet assigned"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Site Manager</Text>
          <Text style={styles.value}>{snapshot.siteManagerName ?? "Not yet assigned"}</Text>
        </View>

        <Text style={styles.h2}>Description of Works</Text>
        <Text style={{ fontSize: 10, lineHeight: 1.4 }}>{snapshot.activityDescription}</Text>

        <Text style={styles.h2}>Hazard Identification & Control Measures</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Activity</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Hazard</Text>
            <Text style={[styles.tableHeaderCell, { width: 45 }]}>Risk</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Control Measures</Text>
          </View>
          {snapshot.hazardLines.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{line.activity}</Text>
              <Text style={[styles.tableCell, { flex: 1.4 }]}>{line.hazard}</Text>
              <Text style={[styles.tableCell, { width: 45, fontFamily: "Helvetica-Bold", color: RISK_COLOR[line.riskRating] }]}>
                {line.riskRating}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{line.controlMeasures}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Required PPE</Text>
        {snapshot.ppeItems.map((item, i) => (
          <Bullet key={i} text={item} styles={styles} />
        ))}

        <Text style={{ marginTop: 16, fontSize: 10 }}>
          This SWMS has been developed in consultation with the workers who will carry out this work and must be
          read and understood by all workers before work commences.
        </Text>
        <Text style={{ marginTop: 12, fontSize: 10 }}>Prepared by,</Text>
        <Text style={{ marginTop: 10, fontFamily: "Helvetica-Bold", fontSize: 10 }}>{snapshot.signOffName}</Text>
        <Text style={{ fontSize: 9, color: snapshot.colors.muted }}>{snapshot.signOffRole}</Text>

        <Text style={styles.footerNote}>
          {snapshot.number} &nbsp;·&nbsp; Revision {snapshot.version - 1}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderSwmsPdf(snapshot: SwmsSnapshot): Promise<Buffer> {
  return renderToBuffer(<SwmsDocument snapshot={snapshot} />);
}
