---
name: push
description: Pushes the current branch to origin. Use when the user says /push, wants to push to origin, or asks to push the current branch.
---

# Push Current Branch to Origin

Use this skill when the user wants to push the current branch to origin (e.g. `/push`).

## Workflow

1. **From project root**, push the current branch to `origin`:
   ```bash
   git push -u origin $(git branch --show-current)
   ```
   If the branch already has an upstream set, `git push` is enough.

2. If push is rejected (e.g. non-fast-forward), **do not** force-push unless the user explicitly asks; report the error and suggest they pull/rebase or confirm force.

## Rules

- Run from the **repository root**.
- Use the current branch only; do not push other branches unless the user asks.
