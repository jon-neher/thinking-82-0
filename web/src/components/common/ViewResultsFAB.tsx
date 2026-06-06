interface ViewResultsFABProps {
  onClick: () => void;
}

export function ViewResultsFAB({ onClick }: ViewResultsFABProps) {
  return (
    <button type="button" className="view-results-fab" onClick={onClick}>
      View Final Results
    </button>
  );
}