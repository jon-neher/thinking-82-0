import { describe, expect, it } from "vitest";
import { evaluateRoster } from "./scoring";
import type { DraftSlot, PlayerSeason, SlotAssignment } from "../types";

function makePlayer(name: string, pos: string, overrides?: Partial<PlayerSeason>): PlayerSeason {
  return {
    id: `${name}-${pos}`,
    pid: `${name}-${pos}`,
    name,
    team: "BOS",
    decade: "1980s",
    season: 1986,
    pos,
    pos2: [],
    g: 80,
    mpg: 34,
    box: { pts: 25, reb: 8, ast: 6, stl: 1.5, blk: 1.1 },
    adv: { ts: 0.6, usg: 27, bpm: 6.5, obpm: 4.5, dbpm: 2.0, per: 24 },
    m: {
      zPts: 1,
      zReb: 1,
      zAst: 1,
      zStl: 1,
      zBlk: 1,
      rtsPP: 4,
      effZ: 1,
      usgEff: 27,
      obpmEff: 4.5,
      dbpmEff: 1.5,
      bpmEff: 6,
      playerBaseNR: 6,
      boxOff: 3,
      boxDef: 2,
      shooting: 1.2,
      rimDef: 0.9,
      perimDef: 0.8,
      hasObservedBPM: true,
      hasObservedDef: true,
      hasObservedUSG: true,
      hasThree: true,
    },
    ...overrides,
  };
}

function roster(players: Record<DraftSlot, PlayerSeason>): SlotAssignment[] {
  return (Object.keys(players) as DraftSlot[]).map((slot) => ({ slot, player: players[slot] }));
}

describe("evaluateRoster", () => {
  it("produces a strong record for a strong balanced lineup", () => {
    const result = evaluateRoster(
      roster({
        PG: makePlayer("A", "PG"),
        SG: makePlayer("B", "SG"),
        SF: makePlayer("C", "SF"),
        PF: makePlayer("D", "PF"),
        C: makePlayer("E", "C"),
        SIXTH: makePlayer("F", "SG"),
      }),
    );
    expect(result.wins).toBeGreaterThan(53);
    expect(result.teamNetRating).toBeGreaterThan(4);
  });

  it("penalizes severe position mismatch", () => {
    const good = evaluateRoster(
      roster({
        PG: makePlayer("A", "PG"),
        SG: makePlayer("B", "SG"),
        SF: makePlayer("C", "SF"),
        PF: makePlayer("D", "PF"),
        C: makePlayer("E", "C"),
        SIXTH: makePlayer("F", "SG"),
      }),
    );
    const bad = evaluateRoster(
      roster({
        PG: makePlayer("A", "C"),
        SG: makePlayer("B", "C"),
        SF: makePlayer("C", "C"),
        PF: makePlayer("D", "PG"),
        C: makePlayer("E", "SG"),
        SIXTH: makePlayer("F", "SF"),
      }),
    );
    expect(bad.positionFitNR).toBeLessThan(good.positionFitNR);
    expect(bad.wins).toBeLessThan(good.wins);
  });

  it("penalizes usage overload", () => {
    const balanced = evaluateRoster(
      roster({
        PG: makePlayer("A", "PG", { m: { ...makePlayer("A", "PG").m, usgEff: 26 } }),
        SG: makePlayer("B", "SG", { m: { ...makePlayer("B", "SG").m, usgEff: 25 } }),
        SF: makePlayer("C", "SF", { m: { ...makePlayer("C", "SF").m, usgEff: 24 } }),
        PF: makePlayer("D", "PF", { m: { ...makePlayer("D", "PF").m, usgEff: 22 } }),
        C: makePlayer("E", "C", { m: { ...makePlayer("E", "C").m, usgEff: 20 } }),
        SIXTH: makePlayer("F", "SG", { m: { ...makePlayer("F", "SG").m, usgEff: 18 } }),
      }),
    );
    const overloaded = evaluateRoster(
      roster({
        PG: makePlayer("A", "PG", { m: { ...makePlayer("A", "PG").m, usgEff: 37 } }),
        SG: makePlayer("B", "SG", { m: { ...makePlayer("B", "SG").m, usgEff: 36 } }),
        SF: makePlayer("C", "SF", { m: { ...makePlayer("C", "SF").m, usgEff: 34 } }),
        PF: makePlayer("D", "PF", { m: { ...makePlayer("D", "PF").m, usgEff: 32 } }),
        C: makePlayer("E", "C", { m: { ...makePlayer("E", "C").m, usgEff: 30 } }),
        SIXTH: makePlayer("F", "SG", { m: { ...makePlayer("F", "SG").m, usgEff: 29 } }),
      }),
    );
    expect(overloaded.usageFitNR).toBeLessThan(balanced.usageFitNR);
  });

  it("rewards slot archetype fit beyond listed position", () => {
    const guardArchetype = makePlayer("Guard", "SF", {
      pos2: ["PG", "C"],
      m: {
        ...makePlayer("Guard", "SF").m,
        zPts: 1.3,
        zAst: 1.6,
        zReb: -0.2,
        zBlk: -0.6,
        shooting: 1.2,
        rimDef: -0.3,
        perimDef: 1.1,
      },
    });
    const bigArchetype = makePlayer("Big", "SF", {
      pos2: ["PG", "C"],
      m: {
        ...makePlayer("Big", "SF").m,
        zPts: 0.4,
        zAst: -0.4,
        zReb: 1.6,
        zBlk: 1.4,
        shooting: -0.2,
        rimDef: 1.4,
        perimDef: -0.3,
      },
    });

    const natural = evaluateRoster(
      roster({
        PG: guardArchetype,
        SG: makePlayer("B", "SG"),
        SF: makePlayer("C", "SF"),
        PF: makePlayer("D", "PF"),
        C: bigArchetype,
        SIXTH: makePlayer("F", "SG"),
      }),
    );

    const inverted = evaluateRoster(
      roster({
        PG: bigArchetype,
        SG: makePlayer("B", "SG"),
        SF: makePlayer("C", "SF"),
        PF: makePlayer("D", "PF"),
        C: guardArchetype,
        SIXTH: makePlayer("F", "SG"),
      }),
    );

    expect(natural.positionFitNR).toBeGreaterThan(inverted.positionFitNR);
    expect(natural.wins).toBeGreaterThan(inverted.wins);
  });
});
