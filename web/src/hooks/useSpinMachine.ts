import { useCallback } from "react";
import { getPlayersForTeamDecade } from "../data/dataset";
import type { PlayerSeason, Roll } from "../types";

interface SpinOptions {
  team?: string;
  decade?: string;
  excludeTeam?: string;
  excludeDecade?: string;
}

interface UseSpinMachineProps {
  teams: string[];
  decades: string[];
  usedTeams: Set<string>;
  usedDecades: Set<string>;
  isComplete: boolean;
  roll: Roll | null;
  setSpinning: (value: boolean) => void;
  setRoll: React.Dispatch<React.SetStateAction<Roll | null>>;
  setDisplayTeam: (team: string | null) => void;
  setDisplayDecade: (decade: string | null) => void;
}

export function useSpinMachine({
  teams,
  decades,
  usedTeams,
  usedDecades,
  isComplete,
  setSpinning,
  setRoll,
  setDisplayTeam,
  setDisplayDecade,
}: UseSpinMachineProps) {
  const buildRollCandidates = useCallback(
    (nextTeam: string, nextDecade: string): PlayerSeason[] => {
      return getPlayersForTeamDecade(nextTeam, nextDecade);
    },
    [],
  );

  const rollPool = useCallback(
    (options?: SpinOptions): Array<{ team: string; decade: string; candidates: PlayerSeason[] }> => {
      const teamPool = options?.team
        ? [options.team]
        : teams.filter((team) => !usedTeams.has(team) && team !== options?.excludeTeam);
      const decadePool = options?.decade
        ? [options.decade]
        : decades.filter((decade) => !usedDecades.has(decade) && decade !== options?.excludeDecade);
      const pools: Array<{ team: string; decade: string; candidates: PlayerSeason[] }> = [];
      for (const team of teamPool) {
        for (const decade of decadePool) {
          if (team === options?.excludeTeam || decade === options?.excludeDecade) {
            continue;
          }
          const candidates = buildRollCandidates(team, decade);
          if (candidates.length) {
            pools.push({ team, decade, candidates });
          }
        }
      }
      return pools;
    },
    [teams, decades, usedTeams, usedDecades, buildRollCandidates],
  );

  const spin = useCallback(
    (options?: SpinOptions) => {
      if (isComplete) {
        return;
      }
      const pool = rollPool(options);
      if (!pool.length) {
        setRoll(null);
        return;
      }
      setSpinning(true);
      setRoll(null);

      const selected = pool[Math.floor(Math.random() * pool.length)];

      const duration = 1000;
      const interval = 60;
      const startTime = Date.now();

      const timer = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          window.clearInterval(timer);
          setDisplayTeam(selected.team);
          setDisplayDecade(selected.decade);
          setRoll(selected);
          setSpinning(false);
        } else {
          if (!options?.team) {
            setDisplayTeam(teams[Math.floor(Math.random() * teams.length)]);
          } else {
            setDisplayTeam(options.team);
          }
          if (!options?.decade) {
            setDisplayDecade(decades[Math.floor(Math.random() * decades.length)]);
          } else {
            setDisplayDecade(options.decade);
          }
        }
      }, interval);
    },
    [isComplete, rollPool, teams, decades, setSpinning, setRoll, setDisplayTeam, setDisplayDecade],
  );

  return { spin };
}