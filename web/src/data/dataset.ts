import raw from "./players.json";
import type { Dataset, PlayerSeason } from "../types";

const dataset = raw as unknown as Dataset;

const byTeamDecade = new Map<string, PlayerSeason[]>();

for (const player of dataset.players) {
  const key = `${player.team}|${player.decade}`;
  const existing = byTeamDecade.get(key);
  if (existing) {
    existing.push(player);
  } else {
    byTeamDecade.set(key, [player]);
  }
}

for (const players of byTeamDecade.values()) {
  players.sort((a, b) => b.m.playerBaseNR - a.m.playerBaseNR);
}

export function getDataset(): Dataset {
  return dataset;
}

export function getPlayersForTeamDecade(team: string, decade: string): PlayerSeason[] {
  return byTeamDecade.get(`${team}|${decade}`) ?? [];
}
