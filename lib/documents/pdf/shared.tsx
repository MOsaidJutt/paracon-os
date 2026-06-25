import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfColorTokens } from "../templates-config";
import type { OrgLetterhead } from "../types";

/**
 * No Nord/Mont font files exist anywhere in the supplied source material
 * (only guidelines.pdf, no .ttf/.otf) — intake notes gap #11. Helvetica is
 * react-pdf's built-in base-14 font (no registration/network fetch needed),
 * used here as the neutral fallback per CLAUDE.md's "closest geometric
 * fallback, never silently substitute a Google default" instruction. The
 * moment licensed Nord/Mont (or a substitute) font files are supplied, swap
 * the family names below — nothing else about the layout needs to change.
 */
export const PDF_FONT = {
  heading: "Helvetica-Bold",
  body: "Helvetica",
};

export function buildPdfStyles(colors: PdfColorTokens) {
  return StyleSheet.create({
    page: {
      paddingTop: 48,
      paddingBottom: 56,
      paddingHorizontal: 48,
      fontFamily: PDF_FONT.body,
      fontSize: 10,
      color: colors.ink,
      backgroundColor: colors.paper,
    },
    letterheadName: {
      fontFamily: PDF_FONT.heading,
      fontSize: 13,
      color: colors.ink,
    },
    letterheadAddress: {
      fontSize: 9,
      color: colors.muted,
      marginTop: 2,
    },
    accentRule: {
      height: 2,
      backgroundColor: colors.accent,
      marginTop: 10,
      marginBottom: 16,
    },
    h1: {
      fontFamily: PDF_FONT.heading,
      fontSize: 14,
      color: colors.ink,
      marginBottom: 8,
    },
    h2: {
      fontFamily: PDF_FONT.heading,
      fontSize: 11,
      color: colors.accent,
      marginTop: 14,
      marginBottom: 6,
      textTransform: "uppercase" as const,
    },
    label: {
      fontFamily: PDF_FONT.heading,
      fontSize: 9,
      color: colors.muted,
      width: 90,
    },
    value: {
      fontSize: 10,
      color: colors.ink,
      flex: 1,
    },
    row: {
      flexDirection: "row" as const,
      marginBottom: 3,
    },
    bullet: {
      flexDirection: "row" as const,
      marginBottom: 4,
    },
    bulletDot: {
      width: 12,
      fontSize: 10,
      color: colors.accent,
    },
    bulletText: {
      flex: 1,
      fontSize: 10,
      lineHeight: 1.4,
    },
    table: {
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.accentSoft,
    },
    tableHeaderRow: {
      flexDirection: "row" as const,
      backgroundColor: colors.accentSoft,
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: "row" as const,
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.accentSoft,
    },
    tableHeaderCell: {
      fontFamily: PDF_FONT.heading,
      fontSize: 8.5,
      color: colors.ink,
    },
    tableCell: {
      fontSize: 9.5,
      color: colors.ink,
    },
    totalsRow: {
      flexDirection: "row" as const,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    totalsLabel: {
      fontFamily: PDF_FONT.heading,
      fontSize: 9.5,
    },
    grandTotalRow: {
      flexDirection: "row" as const,
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginTop: 2,
      backgroundColor: colors.accentSoft,
    },
    footerNote: {
      position: "absolute" as const,
      bottom: 28,
      left: 48,
      right: 48,
      fontSize: 8,
      color: colors.muted,
      textAlign: "center" as const,
    },
  });
}

export function money(amount: number): string {
  return amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Letterhead({
  org,
  styles,
  docTitle,
  docNumber,
}: {
  org: OrgLetterhead;
  styles: ReturnType<typeof buildPdfStyles>;
  docTitle: string;
  docNumber: string;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={styles.letterheadName}>
            {org.legalName} &nbsp;&nbsp; ABN {org.abn}
          </Text>
          <Text style={styles.letterheadAddress}>{org.registeredAddress}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.h1}>{docTitle}</Text>
          <Text style={{ fontSize: 10, color: styles.h1.color }}>{docNumber}</Text>
        </View>
      </View>
      <View style={styles.accentRule} />
    </View>
  );
}

export function FooterNote({ styles, text }: { styles: ReturnType<typeof buildPdfStyles>; text: string }) {
  return <Text style={styles.footerNote}>{text}</Text>;
}
