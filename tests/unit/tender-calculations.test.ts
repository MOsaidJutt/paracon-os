import { describe, expect, it } from "vitest";
import {
  activeStatusesFromWeights,
  calcBidSizeBands,
  calcClientScorecard,
  calcPipelineSummary,
  calcTenderTiming,
  type CalcTender,
} from "@/lib/tenders/calculations";

const BASE = Date.UTC(2026, 0, 1);
const day = (n: number) => new Date(BASE + n * 86_400_000);

const STATUS_WEIGHTS = { "In Progress": 0.3, Submitted: 0.5, "Post Tender": 0.2, Won: 1.0, Lost: 0.0, Withdrawn: 0.0 };

const VALUE_BANDS = [
  { label: "<500k", max: 500_000 },
  { label: "500k-1m", max: 1_000_000 },
  { label: "1m-1.5m", max: 1_500_000 },
  { label: ">1.5m", max: null },
];

// Client A: an in-progress bid, a submitted bid, and a won bid.
// Client B: a lost bid and a withdrawn bid — exercises the resolved/terminal paths.
const TENDERS: CalcTender[] = [
  {
    id: "t1",
    clientId: "A",
    status: "In Progress",
    value: 100_000,
    winProbabilityNumeric: 0.5,
    outcome: null,
    winningBid: null,
    valueBand: "<500k",
    received: day(0),
    due: day(18),
    submitted: null,
    tenderDurationDays: 18,
  },
  {
    id: "t2",
    clientId: "A",
    status: "Submitted",
    value: 600_000,
    winProbabilityNumeric: 0.8,
    outcome: null,
    winningBid: null,
    valueBand: "500k-1m",
    received: day(0),
    due: day(20),
    submitted: day(18),
    tenderDurationDays: 20,
  },
  {
    id: "t3",
    clientId: "A",
    status: "Won",
    value: 1_200_000,
    winProbabilityNumeric: 1.0,
    outcome: "Won",
    winningBid: 1_150_000,
    valueBand: "1m-1.5m",
    received: day(0),
    due: day(5),
    submitted: day(7),
    tenderDurationDays: 5,
  },
  {
    id: "t4",
    clientId: "B",
    status: "Lost",
    value: 300_000,
    winProbabilityNumeric: 0.2,
    outcome: "Lost",
    winningBid: null,
    valueBand: "<500k",
    received: day(0),
    due: day(2),
    submitted: day(1),
    tenderDurationDays: 2,
  },
  {
    id: "t5",
    clientId: "B",
    status: "Withdrawn",
    value: 50_000,
    winProbabilityNumeric: 0.5,
    outcome: null,
    winningBid: null,
    valueBand: "<500k",
    received: day(0),
    due: day(-10),
    submitted: null,
    tenderDurationDays: -10,
  },
];

describe("activeStatusesFromWeights", () => {
  it("treats statuses weighted strictly between 0 and 1 as active", () => {
    expect(activeStatusesFromWeights(STATUS_WEIGHTS).sort()).toEqual(["In Progress", "Post Tender", "Submitted"]);
  });
});

describe("calcPipelineSummary", () => {
  const activeStatuses = activeStatusesFromWeights(STATUS_WEIGHTS);
  const summary = calcPipelineSummary(TENDERS, activeStatuses);

  it("computes weighted pipeline across every tender regardless of status", () => {
    expect(summary.weightedPipeline).toBeCloseTo(50_000 + 480_000 + 1_200_000 + 60_000 + 25_000, 5);
  });

  it("computes total pipeline and active bid count from in-flight statuses only", () => {
    expect(summary.totalPipeline).toBe(700_000);
    expect(summary.activeBids).toBe(2);
  });

  it("computes win rate by count and by value from Outcome, not Status", () => {
    expect(summary.winRateCount).toBeCloseTo(0.5, 5);
    expect(summary.winRateValue).toBeCloseTo(1_150_000 / 1_500_000, 5);
  });

  it("computes submission rate, revenue won and avg bid value", () => {
    expect(summary.submissionRate).toBeCloseTo(0.2, 5);
    expect(summary.revenueWon).toBe(1_150_000);
    expect(summary.avgBidValue).toBeCloseTo(450_000, 5);
  });
});

describe("calcBidSizeBands", () => {
  const activeStatuses = activeStatusesFromWeights(STATUS_WEIGHTS);
  const bands = calcBidSizeBands(TENDERS, VALUE_BANDS, activeStatuses);

  it("aggregates the <500k band (t1, t4, t5)", () => {
    const band = bands.find((b) => b.label === "<500k")!;
    expect(band.totalBids).toBe(3);
    expect(band.wins).toBe(0);
    expect(band.winRateCount).toBe(0);
    expect(band.avgBidValue).toBeCloseTo(150_000, 5);
    expect(band.pipelineValue).toBe(100_000);
  });

  it("aggregates the 1m-1.5m band (t3, the only win)", () => {
    const band = bands.find((b) => b.label === "1m-1.5m")!;
    expect(band.totalBids).toBe(1);
    expect(band.wins).toBe(1);
    expect(band.winRateCount).toBe(1);
    expect(band.winRateValue).toBeCloseTo(1_150_000 / 1_200_000, 5);
    expect(band.revenueWon).toBe(1_150_000);
    expect(band.pipelineValue).toBe(0); // Won is not an active/in-flight status
  });

  it("returns zeroed rows for empty bands instead of NaN", () => {
    const band = bands.find((b) => b.label === ">1.5m")!;
    expect(band).toEqual({
      label: ">1.5m",
      totalBids: 0,
      wins: 0,
      winRateCount: 0,
      winRateValue: 0,
      revenueWon: 0,
      avgBidValue: 0,
      pipelineValue: 0,
    });
  });
});

describe("calcTenderTiming", () => {
  const activeStatuses = activeStatusesFromWeights(STATUS_WEIGHTS);
  const today = day(15);
  const timing = calcTenderTiming(TENDERS, activeStatuses, today);

  it("averages duration only over tenders with a positive duration", () => {
    expect(timing.avgDurationDays).toBeCloseTo((18 + 20 + 5 + 2) / 4, 5);
  });

  it("computes late/on-time submission rates from submitted vs due", () => {
    expect(timing.lateSubmissionRate).toBeCloseTo(1 / 3, 5); // only t3 submitted after its due date
    expect(timing.onTimeSubmissionRate).toBeCloseTo(2 / 3, 5);
  });

  it("computes rush-tender rate (<3 day turnaround)", () => {
    expect(timing.rushTenderRate).toBeCloseTo(1 / 4, 5); // only t4
  });

  it("flags due-this-week for an active tender not yet submitted", () => {
    expect(timing.dueThisWeek).toBe(1); // t1 (In Progress), due in 3 days
  });

  it("excludes withdrawn tenders from overdue even though they were never submitted", () => {
    expect(timing.overdue).toBe(0); // t5 is Withdrawn (terminal), not "at risk" despite its past due date
  });

  it("counts an active, not-yet-submitted tender past its due date as overdue", () => {
    const overdueActive: CalcTender = { ...TENDERS[0], id: "t6", status: "In Progress", due: day(-5) };
    const result = calcTenderTiming([overdueActive], activeStatuses, today);
    expect(result.overdue).toBe(1);
  });
});

describe("calcClientScorecard", () => {
  const activeStatuses = activeStatusesFromWeights(STATUS_WEIGHTS);
  const scorecard = calcClientScorecard(TENDERS, activeStatuses);

  it("computes a perfect win rate and full pipeline value for client A", () => {
    const clientA = scorecard.find((c) => c.clientId === "A")!;
    expect(clientA.bidCount).toBe(3);
    expect(clientA.wins).toBe(1);
    expect(clientA.winRate).toBe(1);
    expect(clientA.avgJobValue).toBeCloseTo(1_900_000 / 3, 5);
    expect(clientA.totalWonValue).toBe(1_150_000);
    expect(clientA.pipelineValue).toBe(700_000);
    expect(clientA.score).toBeCloseTo(1_900_000, 5);
  });

  it("computes a zero win rate and zero pipeline for client B (lost + withdrawn)", () => {
    const clientB = scorecard.find((c) => c.clientId === "B")!;
    expect(clientB.winRate).toBe(0);
    expect(clientB.pipelineValue).toBe(0);
    expect(clientB.score).toBe(0);
  });
});
