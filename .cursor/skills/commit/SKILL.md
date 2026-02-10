---
name: commit
description: Commits all changes on the current branch with a detailed commit message. Use when the user says /commit, wants to commit changes, or asks to commit with a message. Generates the message from the diff.
---

# Commit All Changes

Use this skill when the user wants to commit all changes with a detailed commit message (e.g. `/commit`).

## Workflow

1. **From project root**, run `git status` and `git diff` (and `git diff --staged` if needed) to see what changed.
2. **Generate a detailed commit message** from the changes:
   - One short subject line (≤72 chars), then optional body with scope/details.
   - Prefer conventional style when it fits: `type(scope): subject` (e.g. `feat(auth): add forgot-password link`, `fix(api): correct version header`).
   - Summarize what was done and why, not just file names.
3. **Stage all changes**: `git add -A` (or `git add -u` if only tracking updates/deletes).
4. **Commit** with the generated message: `git commit -m "Subject" -m "Body..."` (or a single `-m` if one line suffices).

## Rules

- If there are **no changes** to commit, say so and do not run `git commit`.
- Do **not** commit secrets, env files with real credentials, or unrelated junk; if in doubt, skip or ask.
- Run from the **repository root** (e.g. `parking-gate-remote`).
