import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude/` is untracked tooling scratch (incl. nested git worktrees) — never
  // lint it; a nested worktree checkout otherwise trips typescript-eslint's
  // "multiple candidate TSConfigRootDirs" root detection. `dist/` is build output.
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/', '.claude/'] },
  ...tseslint.configs.recommended,
);
