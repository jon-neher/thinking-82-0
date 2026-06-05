import type { DraftSlot, SlotAssignment, TeamScore } from "../types";

const SLOT_MINUTES: Record<DraftSlot, number> = {
  PG: 34,
  SG: 34,
  SF: 34,
  PF: 34,
  C: 34,
  SIXTH: 26,
};

const POSITION_INDEX: Record<string, number> = {
  PG: 0,
  SG: 1,
  SF: 2,
  PF: 3,
  C: 4,
};

const TOTAL_TEAM_MINUTES = 240;
const CORE_MINUTES_TOTAL = 196;
const BENCH_MINUTES = TOTAL_TEAM_MINUTES - CORE_MINUTES_TOTAL;
const BENCH_NET_RATING = -1.0;
const CORE_SCALE = 1.15;
const USG_CAPS = [33, 28, 24, 21, 19, 18];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function logisticWinPct(netRating: number): number {
  return 1 / (1 + Math.exp(-netRating / 7.5));
}

function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function primaryAndSecondary(pos: string, pos2: string[]): string[] {
  const parts = [pos, ...pos2].map((part) => part.trim()).filter(Boolean);
  return Array.from(new Set(parts));
}

function slotPenalty(slot: DraftSlot, pos: string, pos2: string[]): number {
  if (slot === "SIXTH") {
    return 0;
  }
  const slotIndex = POSITION_INDEX[slot];
  const positions = primaryAndSecondary(pos, pos2);
  const primary = positions[0];
  const secondary = positions.slice(1);
  if (primary === slot) {
    return 0;
  }
  if (secondary.includes(slot)) {
    return 0.4;
  }
  const primaryIndex = POSITION_INDEX[primary] ?? 2;
  const diff = Math.abs(slotIndex - primaryIndex);
  if (diff === 1) {
    return 1.2;
  }
  if (diff === 2) {
    return 2.5;
  }
  return 4;
}

export function evaluateRoster(assignments: SlotAssignment[]): TeamScore {
  if (assignments.length !== 6) {
    throw new Error("Roster must include 6 drafted players.");
  }

  const bySlot = new Map(assignments.map((assignment) => [assignment.slot, assignment]));

  for (const slot of Object.keys(SLOT_MINUTES) as DraftSlot[]) {
    if (!bySlot.has(slot)) {
      throw new Error(`Missing slot assignment for ${slot}.`);
    }
  }

  let weightedBase = 0;
  let weightedOff = 0;
  let weightedDef = 0;

  for (const { slot, player } of assignments) {
    const slotWeight = SLOT_MINUTES[slot] / TOTAL_TEAM_MINUTES;
    weightedBase += slotWeight * player.m.playerBaseNR;
    weightedOff += slotWeight * player.m.obpmEff;
    weightedDef += slotWeight * player.m.dbpmEff;
  }

  const baseTeamNR = CORE_SCALE * weightedBase + (BENCH_MINUTES / TOTAL_TEAM_MINUTES) * BENCH_NET_RATING;
  const baseOffNR = CORE_SCALE * weightedOff;
  const baseDefNR =
    CORE_SCALE * weightedDef + (BENCH_MINUTES / TOTAL_TEAM_MINUTES) * BENCH_NET_RATING;

  const usageOrdered = [...assignments].sort((a, b) => b.player.m.usgEff - a.player.m.usgEff);

  let rankPenalty = 0;
  for (let i = 0; i < usageOrdered.length; i += 1) {
    const item = usageOrdered[i];
    const cap = USG_CAPS[i];
    rankPenalty +=
      (SLOT_MINUTES[item.slot] / CORE_MINUTES_TOTAL) *
      Math.pow(Math.max(0, item.player.m.usgEff - cap), 2);
  }
  rankPenalty *= 0.06;

  let weightedUsg = 0;
  let offBallBonus = 0;
  for (const { slot, player } of assignments) {
    const weight = SLOT_MINUTES[slot] / CORE_MINUTES_TOTAL;
    weightedUsg += SLOT_MINUTES[slot] * player.m.usgEff;
    offBallBonus += weight * Math.max(0, 22 - player.m.usgEff) * Math.max(0, player.m.rtsPP);
  }
  const avgUsg = weightedUsg / CORE_MINUTES_TOTAL;
  const top1Usg = usageOrdered[0].player.m.usgEff;
  const top2Usg = usageOrdered[1].player.m.usgEff;
  const avgOverload = 0.08 * Math.pow(Math.max(0, avgUsg - 23.5), 2);
  const shortage =
    0.1 * Math.pow(Math.max(0, 26 - top1Usg), 2) +
    0.04 * Math.pow(Math.max(0, 50 - top1Usg - top2Usg), 2) +
    0.15 * Math.pow(Math.max(0, 18 - avgUsg), 2);
  const usageFitNR = clamp(0.12 * offBallBonus - rankPenalty - avgOverload - shortage, -6, 2);

  const shootingScores = assignments.map((assignment) => assignment.player.m.shooting);
  const top3Shooting = mean([...shootingScores].sort((a, b) => b - a).slice(0, 3));
  const teamAvgShooting =
    assignments.reduce(
      (sum, assignment) => sum + (SLOT_MINUTES[assignment.slot] / CORE_MINUTES_TOTAL) * assignment.player.m.shooting,
      0,
    );
  const spacingFitNR = clamp(
    1.2 * (top3Shooting - 0.4) + 0.6 * (teamAvgShooting - 0.1),
    -3,
    3,
  );

  const c = bySlot.get("C")!.player;
  const pf = bySlot.get("PF")!.player;
  const pg = bySlot.get("PG")!.player;
  const sg = bySlot.get("SG")!.player;
  const sf = bySlot.get("SF")!.player;
  const otherBigCandidates = [pg, sg, sf, bySlot.get("SIXTH")!.player].filter((player) =>
    primaryAndSecondary(player.pos, player.pos2).some((item) => item === "PF" || item === "C"),
  );
  const bestOtherBig = otherBigCandidates.length
    ? otherBigCandidates.reduce((best, current) =>
        current.m.rimDef > best.m.rimDef ? current : best,
      )
    : sf;

  const rimProtection = 0.55 * c.m.rimDef + 0.25 * pf.m.rimDef + 0.2 * bestOtherBig.m.rimDef;
  const perimeterDefense = mean([pg.m.perimDef, sg.m.perimDef, sf.m.perimDef]);
  const defenseFitNR = clamp(
    0.45 * rimProtection +
      0.35 * perimeterDefense -
      1.0 * Math.max(0, 0.3 - rimProtection) -
      0.7 * Math.max(0, 0.2 - perimeterDefense),
    -3,
    3,
  );

  let positionFitNR = 0;
  for (const { slot, player } of assignments) {
    positionFitNR -= (SLOT_MINUTES[slot] / 34) * slotPenalty(slot, player.pos, player.pos2);
  }

  const rawTeamNR = baseTeamNR + usageFitNR + spacingFitNR + defenseFitNR + positionFitNR;
  const teamNetRating = clamp(rawTeamNR, -25, 25);
  const winPct = logisticWinPct(teamNetRating);
  const wins = Math.round(82 * winPct);
  const losses = 82 - wins;

  return {
    teamNetRating,
    wins,
    losses,
    baseTeamNR,
    usageFitNR,
    spacingFitNR,
    defenseFitNR,
    positionFitNR,
    offenseNR: baseOffNR + usageFitNR + spacingFitNR,
    defenseNR: baseDefNR + defenseFitNR + positionFitNR,
  };
}
