---
name: qa-web
description: >
  QA tests for the web app. Validates core gameplay flows, slot assignment logic,
  and reveal/scoring UX in the React + Vite frontend.
---

# QA Web Module

## App Context

- App path: `web/`
- Stack: React 18 + TypeScript + Vite
- Primary surface: single-page game UI in `web/src/App.tsx`

## Testing Target (MANDATORY)

This repo does **not** use detected Vercel/Netlify preview deployments.
For PR validation, test branch code by running a local dev server:

1. Start local server from repo root:
   - `npm --prefix web run dev -- --host 127.0.0.1 --port 5173`
2. Wait until `http://127.0.0.1:5173` responds.
3. Use `http://127.0.0.1:5173` as base URL.

If local server cannot start or is unreachable, mark all web tests as `:no_entry: BLOCKED`.
Do **not** fall back to remote dev/staging/prod URLs.

## Authentication in CI

- No authentication is required for this app.
- No credential env vars are required for default guest flows.

## Personas

### guest
- Anonymous user
- Runs all gameplay flows end-to-end

## Flow Menu (pick only diff-relevant flows)

1. **Game boot and spin availability**
   - Page loads without runtime errors.
   - Round indicator renders.
   - Spin button appears and transitions to loading/ready states correctly.

2. **Roll generation and candidate list**
   - Spin reveals team + era cards.
   - Candidate list populates with players for that roll.
   - Search and position filters narrow results correctly.

3. **Player selection and court slotting**
   - Selecting a player highlights placeable slots.
   - Assigning player to a valid slot updates court and board list.
   - Invalid placements are prevented.

4. **Mid-game re-slot and swap behavior**
   - Clicking filled slots selects existing roster players.
   - Repositioning selected player to another legal slot works.
   - Swap path works only when both players are legal in exchanged slots.

5. **Skip controls behavior**
   - Skip Team and Skip Era decrement counters and reroll within constraints.
   - Controls disable when no skips remain.

6. **Mode and advanced panel behavior**
   - Classic/HoopIQ toggles update stat visibility expectations.
   - Advanced panel can be shown/hidden and displays selected player metrics in Classic mode.

7. **Completion and final reveal**
   - Filling all six slots triggers final record panel.
   - Wins/losses, net rating, and breakdown fields render.
   - Copy result action produces expected clipboard string format.

8. **Negative and edge checks**
   - With selected player and no placeable empty slots, clicking a non-placeable filled slot should select that slot’s player (must not silently skip state).
   - Empty candidate filter state shows proper empty-message text.

## Execution Rules

- Run only flows relevant to changed files.
- Include at least one negative/edge test tied to the diff.
- Capture text snapshots after meaningful UI state changes.
- Never silently skip a flow. If blocked, report what was tried and remediation.

## Known Failure Modes

1. **Dataset missing in web src.** If `web/src/data/players.json` is missing, the app may fail to load data. Run `npm --prefix web run syncdata` and restart.
2. **Spin disabled while roll exists.** The Spin button is intentionally disabled until current roll resolves (or game resets); this is expected behavior.
3. **Local server port conflicts.** If 5173 is occupied, start Vite on another port and use that URL consistently in the run.
