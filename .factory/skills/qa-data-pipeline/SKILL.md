---
name: qa-data-pipeline
description: >
  QA tests for the data pipeline. Validates that generated player dataset artifacts
  are present, schema-compatible, and consumable by the web app.
---

# QA Data Pipeline Module

## App Context

- Paths: `data/pipeline/`, `data/players.json`, `web/src/data/players.json`
- Stack: Python scripts + JSON artifacts
- Primary command: `python3 data/pipeline/build.py`

## Testing Target

Run checks against the branch workspace files directly (no remote environment).

## Authentication in CI

- No authentication required.
- No secret env vars required for default checks.

## Flow Menu (pick only diff-relevant flows)

1. **Dataset artifact presence**
   - Verify `data/players.json` exists and is readable.
   - If web artifact is expected, verify `web/src/data/players.json` exists.

2. **Dataset schema sanity**
   - Verify top-level keys: `meta`, `decades`, `teams`, `players`.
   - Verify representative player record fields needed by app (`id`, `team`, `decade`, `pos`, `pos2`, `m.playerBaseNR`).

3. **Pipeline-output compatibility with frontend**
   - Confirm `web/src/types.ts` and dataset field shapes are aligned for changed fields.
   - Spot-check array-vs-string-sensitive fields (`pos2`, `positions`, `sampleSeasons`).

4. **Regeneration integrity (when pipeline logic changes)**
   - If `data/pipeline/build.py` changed, run full rebuild and verify output JSON is valid.
   - Ensure output remains loadable by `web/src/data/dataset.ts` lookup flow.

5. **Negative checks**
   - Detect malformed/missing keys and report BLOCKED/FAIL with exact missing path.

## Execution Rules

- Prefer lightweight schema/consistency checks unless pipeline logic changed.
- For expensive full rebuilds, run only when diff requires it.
- Never silently skip a flow. If blocked, report what was tried and remediation.

## Known Failure Modes

1. **Missing cached source tables.** Full rebuild can fail if required BBR raw tables are absent or stale; run `python3 data/pipeline/fetch.py` first.
2. **Long rebuild time.** `build.py` can take significant time; this is expected for full historical recomputation.
3. **Frontend sync drift.** `data/players.json` may update without syncing `web/src/data/players.json`; run `npm --prefix web run syncdata`.
