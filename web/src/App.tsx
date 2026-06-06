import { useCallback } from "react";
import { Header, SpinMachine, CandidateList, CourtBoard, ResultsModal, ViewResultsFAB } from "./components";
import { useGameState } from "./hooks/useGameState";
import { useSpinMachine } from "./hooks/useSpinMachine";
import { useDraft } from "./hooks/useDraft";
import { useShare } from "./hooks/useShare";

export default function App() {
  const {
    dataset,
    teams,
    decades,
    mode,
    setMode,
    roster,
    setRoster,
    roll,
    setRoll,
    spinning,
    setSpinning,
    displayTeam,
    setDisplayTeam,
    displayDecade,
    setDisplayDecade,
    teamSkips,
    setTeamSkips,
    decadeSkips,
    setDecadeSkips,
    positionFilter,
    setPositionFilter,
    search,
    setSearch,
    setSelectedPlayerId,
    showResults,
    setShowResults,
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    usedTeams,
    usedDecades,
    openSlots,
    isComplete,
    teamScore,
    selectedPlayer,
    selectedSlots,
    sortedCandidates,
    roundNumber,
    fitTotal,
  } = useGameState();

  const { spin } = useSpinMachine({
    teams,
    decades,
    usedTeams,
    usedDecades,
    isComplete,
    roll,
    setSpinning,
    setRoll,
    setDisplayTeam,
    setDisplayDecade,
  });

  const { handleCourtSlotClick, resetGame } = useDraft({
    roster,
    setRoster,
    roll,
    setRoll,
    setSelectedPlayerId,
    selectedSlots,
    selectedPlayer,
  });

  const { shareResult } = useShare({ teamScore });

  const handleSpin = useCallback(() => {
    spin();
  }, [spin]);

  const handleReRollTeam = useCallback(() => {
    if (!roll) return;
    setTeamSkips((value) => value - 1);
    spin({ decade: roll.decade, excludeTeam: roll.team });
  }, [roll, setTeamSkips, spin]);

  const handleReRollDecade = useCallback(() => {
    if (!roll) return;
    setDecadeSkips((value) => value - 1);
    spin({ team: roll.team, excludeDecade: roll.decade });
  }, [roll, setDecadeSkips, spin]);

  const handleSortChange = useCallback((key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "name" ? "asc" : "desc");
  }, [sortKey, setSortDirection, setSortKey]);

  const handleCloseResults = useCallback(() => {
    setShowResults(false);
  }, [setShowResults]);

  const handleViewCourt = useCallback(() => {
    setShowResults(false);
  }, [setShowResults]);

  const handleViewResults = useCallback(() => {
    setShowResults(true);
  }, [setShowResults]);

  return (
    <div className="app-shell">
      <Header
        roundNumber={roundNumber}
        mode={mode}
        onModeChange={setMode}
        onNewGame={resetGame}
      />

      <main className="layout">
        <SpinMachine
          roll={roll}
          spinning={spinning}
          displayTeam={displayTeam}
          displayDecade={displayDecade}
          teamSkips={teamSkips}
          decadeSkips={decadeSkips}
          isComplete={isComplete}
          dataset={dataset}
          onSpin={handleSpin}
          onReRollTeam={handleReRollTeam}
          onReRollDecade={handleReRollDecade}
        />

        <CandidateList
          roll={roll}
          mode={mode}
          positionFilter={positionFilter}
          setPositionFilter={setPositionFilter}
          search={search}
          setSearch={setSearch}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          sortedCandidates={sortedCandidates}
          openSlots={openSlots}
          selectedPlayer={selectedPlayer}
          setSelectedPlayerId={setSelectedPlayerId}
        />
      </main>

      <CourtBoard
        roster={roster}
        selectedPlayer={selectedPlayer}
        selectedSlots={selectedSlots}
        onSlotClick={handleCourtSlotClick}
      />

      {teamScore && showResults ? (
        <ResultsModal
          teamScore={teamScore}
          fitTotal={fitTotal ?? 0}
          onClose={handleCloseResults}
          onShare={shareResult}
          onViewCourt={handleViewCourt}
        />
      ) : null}

      {isComplete && !showResults && <ViewResultsFAB onClick={handleViewResults} />}
    </div>
  );
}