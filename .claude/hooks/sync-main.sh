#!/usr/bin/env bash
# SessionStart hook: bring local main up to date with origin/main, or say why not.
# Stdout is added to Claude's context. Never fails the session start.

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

if ! timeout 15 git fetch origin main --quiet 2>/dev/null; then
  echo "[sync-main] Could not fetch origin/main (offline?) — remote status below may be stale."
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
short=$(git rev-parse --short origin/main 2>/dev/null)

if [ "$branch" != "main" ]; then
  echo "[sync-main] On branch '$branch' (not main). origin/main ($short) has $behind commit(s) not in this branch."
  exit 0
fi

if [ "$behind" = "0" ]; then
  echo "[sync-main] main is up to date with origin/main ($short)${ahead:+, $ahead local commit(s) ahead}." | sed 's/, 0 local commit(s) ahead//'
  exit 0
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "[sync-main] main is $behind commit(s) behind origin/main ($short); NOT pulled because the working tree has uncommitted changes."
  exit 0
fi

if git merge --ff-only --quiet origin/main >/dev/null 2>&1; then
  echo "[sync-main] Fast-forwarded main by $behind commit(s) to origin/main ($short)."
else
  echo "[sync-main] main has diverged from origin/main ($ahead ahead, $behind behind); NOT pulled — needs a manual merge or rebase."
fi
exit 0
