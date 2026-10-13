# Agent instructions

## Shared knowledge base

For tasks needing project context (identity, architecture, status, sources,
owners, decisions or open questions), consult Atlas even when the request does
not mention it. Resolve `KB_ROOT` from this project's Git root using the actual
`sysadmin-workspace` mount; in the current layout it is `../sysadmin-workspace`.
Verify that `KB_ROOT` is that repository's Git root and contains `AGENTS.md`,
`atlas/AGENTS.md` and `atlas/catalog/`. If the layout changes, use the session's
declared, accessible mount; do not guess host paths.

Read those instructions and the relevant skill before responding or working:

- For project context, navigation, sources, relationships, owners or status,
  open `KB_ROOT/.agents/skills/atlas-navigate/SKILL.md`.
- For a requested knowledge-base update or reconciliation, also open
  `KB_ROOT/.agents/skills/atlas-maintain/SKILL.md` and follow its existing intake.

If the skills are absent from the native catalog, explicitly open and read those
files; this pointer does not automatically include their contents. A neighboring
mount does not guarantee native registration. If access is missing, report the
limit without creating mounts, installing plugins or copying skills. Skill scope
is an instruction, not permission: the user's mandate and available access govern.
An Atlas update request alone does not authorize changes to this repository,
other repositories, Notion or runtime.

## Technical language and commits

Follow the [canonical Atlas directive](https://github.com/pablitxn/sysadmin-workspace/blob/35be24cdef1275a3d850c9ccb999e11c3ffe6609/atlas/ops/standards/engineering-language-and-commits.md)
at verified revision `35be24cdef1275a3d850c9ccb999e11c3ffe6609`
([draft PR #5](https://github.com/pablitxn/sysadmin-workspace/pull/5)).
Upstream merge/adoption is pending; the mounted Atlas main does not contain this
policy. Until it is available there, use this concise fallback:

- Write repository-authored technical documentation, agent instructions, code
  comments, test descriptions and PR titles/bodies in English.
- Preserve API identifiers/contracts, paths, localization, product content,
  fixture values, external names, original source quotations and immutable
  historical evidence. Record ambiguous exceptions for human review.
- Use English Conventional Commits for new commits: `type(scope): description`.
  Use a meaningful scope and write authored commit bodies in English too.
  Do not rewrite published history or force push to repair old commit messages.
- Use existing validation conventions. Executable structural checks cannot prove
  English fluency, accurate translation, exception classification or unchanged
  evidence meaning; those require human review. Record checks actually run,
  pre-existing failures, tested revisions and remaining limits in the audit.
- Coordinate changes to shared files across QA branches. Keep language work
  separate from integration and preserve local/HTTPS/physical-test distinctions,
  the Yoga preview failure and deferred model/Blender acceptance. Do not introduce
  TLS bypasses or certificate-trust changes to obtain passing results.
