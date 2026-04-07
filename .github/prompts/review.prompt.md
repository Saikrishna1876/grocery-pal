---
description: 'Review uncommitted changes for security issues, config mismatches, and correctness risks'
name: 'review'
argument-hint: 'Optional scope, files, or extra checks'
agent: 'agent'
---

Run a focused code review of the current workspace's **uncommitted changes**.

## Goal

Check whether recent changes are done correctly, with emphasis on:

- Security bugs and risky patterns
- Configuration mismatches or misconfigurations
- Behavioral regressions and logic errors
- Missing validation, error handling, or tests

## Review Process

1. Inspect git state (`staged` + `unstaged`) and summarize changed files.
2. Review diffs file-by-file; prioritize high-impact code paths.
3. Flag issues with clear severity (`critical`, `high`, `medium`, `low`) and confidence.
4. For each issue, include:
   - File path and line reference
   - Why it is a problem
   - A concrete fix recommendation
5. Identify gaps:
   - Missing tests for changed behavior
   - Missing config/env updates
   - Inconsistent naming/contracts/types across touched modules
6. If no issues are found, explicitly say so and list residual risks or checks still worth running.

## Output Format

- `Findings` (ordered by severity)
- `Open Questions / Assumptions`
- `Suggested Fixes`
- `Optional Verification Steps`

## Notes

- Focus on correctness and risk, not style-only nits.
- Use concise, actionable feedback.
- If user supplied extra scope in arguments, prioritize that first.
