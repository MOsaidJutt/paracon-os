import { describe, expect, it } from "vitest";
import { calcOverallScore, assertScoreEditable } from "@/lib/scorecard/calc";
import type { MetricConfig } from "@/lib/validations/config";

const EVEN_METRICS: MetricConfig[] = [
  { key: "quality", label: "Quality", weight: 0.25, scaleMax: 5, source: "MANUAL" },
  { key: "reliability", label: "Reliability", weight: 0.25, scaleMax: 5, source: "AUTO" },
  { key: "productivity", label: "Productivity", weight: 0.25, scaleMax: 5, source: "AUTO" },
  { key: "safety", label: "Safety", weight: 0.25, scaleMax: 5, source: "MANUAL" },
];

describe("calcOverallScore", () => {
  it("scores 100 when every metric is maxed", () => {
    const score = calcOverallScore({ quality: 5, reliability: 5, productivity: 5, safety: 5 }, EVEN_METRICS);
    expect(score).toBe(100);
  });

  it("scores 0 when every metric is at the floor", () => {
    const score = calcOverallScore({ quality: 0, reliability: 0, productivity: 0, safety: 0 }, EVEN_METRICS);
    expect(score).toBe(0);
  });

  it("scores 50 when every metric sits at the midpoint", () => {
    const score = calcOverallScore({ quality: 2.5, reliability: 2.5, productivity: 2.5, safety: 2.5 }, EVEN_METRICS);
    expect(score).toBe(50);
  });

  it("weights metrics unevenly", () => {
    // Quality (weight .7) maxed, everything else (combined weight .3) at floor -> 70.
    const metrics: MetricConfig[] = [
      { key: "quality", label: "Quality", weight: 0.7, scaleMax: 5, source: "MANUAL" },
      { key: "safety", label: "Safety", weight: 0.3, scaleMax: 5, source: "MANUAL" },
    ];
    const score = calcOverallScore({ quality: 5, safety: 0 }, metrics);
    expect(score).toBe(70);
  });

  it("normalises correctly even when weights don't sum to 1", () => {
    // Weights sum to 2 (not 1) but both maxed -> still 100, not 200.
    const metrics: MetricConfig[] = [
      { key: "quality", label: "Quality", weight: 1, scaleMax: 5, source: "MANUAL" },
      { key: "safety", label: "Safety", weight: 1, scaleMax: 5, source: "MANUAL" },
    ];
    const score = calcOverallScore({ quality: 5, safety: 5 }, metrics);
    expect(score).toBe(100);
  });

  it("combines metrics with different scales fairly", () => {
    // A 0-10 metric at 5 (50%) and a 0-5 metric at 2.5 (50%), equal weight -> 50.
    const metrics: MetricConfig[] = [
      { key: "wide", label: "Wide scale", weight: 0.5, scaleMax: 10, source: "MANUAL" },
      { key: "narrow", label: "Narrow scale", weight: 0.5, scaleMax: 5, source: "MANUAL" },
    ];
    const score = calcOverallScore({ wide: 5, narrow: 2.5 }, metrics);
    expect(score).toBe(50);
  });

  it("treats a missing metric score as 0, not as excluded from the weighting", () => {
    const score = calcOverallScore({ quality: 5 }, [
      { key: "quality", label: "Quality", weight: 0.5, scaleMax: 5, source: "MANUAL" },
      { key: "safety", label: "Safety", weight: 0.5, scaleMax: 5, source: "MANUAL" },
    ]);
    expect(score).toBe(50);
  });

  it("clamps an out-of-range score rather than letting it skew the result", () => {
    const score = calcOverallScore({ quality: 999 }, [
      { key: "quality", label: "Quality", weight: 1, scaleMax: 5, source: "MANUAL" },
    ]);
    expect(score).toBe(100);
  });

  it("returns 0 when there are no metrics configured at all", () => {
    expect(calcOverallScore({}, [])).toBe(0);
  });
});

describe("assertScoreEditable", () => {
  it("allows editing an unlocked score", () => {
    expect(() => assertScoreEditable({ lockedAt: null })).not.toThrow();
  });

  it("blocks editing a locked score", () => {
    expect(() => assertScoreEditable({ lockedAt: new Date() })).toThrow(/locked/i);
  });
});
