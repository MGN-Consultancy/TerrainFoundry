# Focused workspace and release work

- Start with `git status --short` and `pnpm inventory:source`. Search tracked source with `git ls-files` or path-scoped `rg`; do not recursively inventory the whole working directory for routine tasks.
- `work/`, `premium-assets/`, `deliverables/`, `release/`, `dist/`, `test-results/`, `.tools/`, `node_modules/` and generated geometry are local working material. Inspect only a named relevant file when the task requires it. Never delete the collection to make Git smaller.
- Tests and their small source fixtures belong in Git; generated test output does not. Run focused tests during development and the required release checks before publication.
- Desktop releases use `.github/workflows/release.yml` and its client/scenery packaging. Do not zip the checkout or copy working folders into deployment. Website deployment has a separate workflow.
- Preserve existing unrelated edits. Do not rewrite Git history or change the publishing repository without resolving the intended target with the user.
