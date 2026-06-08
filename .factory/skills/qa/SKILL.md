---
name: qa
description: >
  Run QA tests for thinking-82-0. Analyzes git diff to determine affected areas,
  runs configured test flows with personas, and generates diff-targeted tests.
  Uses agent-browser for web testing and command-line checks for data artifacts.
---

# QA Orchestrator

**SCOPE: This skill performs manual/functional QA only. Do NOT run or report on linting, typecheck, unit tests, or static analysis.**

## Step 1: Load Configuration

Read `.factory/skills/qa/config.yaml` for environments, restrictions, personas, and app mappings.

## Step 2: Determine Target Environment

Use `default_target` unless the user specifies another environment.
Respect environment restrictions.

## Step 3: Analyze Git Diff

Run `git diff` and map changed files to apps using `apps.<app>.path_patterns`.

- If an app is affected: run only that app sub-skill.
- If an app is not affected: do not run it.
- If no app code is affected: report `:grey_question: INCONCLUSIVE` with: "No app code changed -- QA not applicable for this diff."

## Step 4: Run App-Specific Pre-flight

Run pre-flight only for affected apps.

For `web`:
- ensure base URL is available (from local dev server for this repository)
- if unavailable, report BLOCKED with remediation

## Step 5: Execute Diff-Relevant Flows Only

Load only relevant app module(s), e.g. `.factory/skills/qa-web/SKILL.md`.
Run only flows that validate changed behavior and adjacent integration behavior.
Add ad-hoc tests if no existing flow covers the change.

## Step 6: Evidence Capture

Use text evidence as primary output:
- Web: capture accessibility tree snapshots using agent-browser snapshot commands.
- Save screenshots/GIFs to `./qa-results/$RUN_ID/` as artifact files.
- Do not embed broken image links in report markdown.

## Step 7: Test Quality Gate

1. Prioritize tests that directly validate changed behavior.
2. Include at least one negative/boundary test related to the change.
3. Avoid unrelated flows.
4. If unclear what changed, report INCONCLUSIVE.

## Step 8: Handle Failures

**Never silently skip a flow. If a flow cannot complete, report it as BLOCKED with what was tried and how the user can fix it.**

## Step 9: Generate Report

Write `./qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`.

## Step 10: Suggest Skill Updates (Failure Learning)

If BLOCKED/FAIL reveals a new testing-environment pattern not already documented, add a `Suggested Skill Updates` section to the report with exact markdown snippets and target file locations.
