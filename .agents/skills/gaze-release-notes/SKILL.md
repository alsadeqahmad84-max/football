---
name: gaze-release-notes
description: Draft, rewrite, or review curated GitHub release notes for Gaze and related PIInuts projects. Invoke when the user says “gaze this”, asks for Gaze release notes, or asks to rewrite or review a Gaze GitHub Release body.
---

# Gaze Release Notes

Use this workflow for GitHub release bodies for Gaze, gaze-lens, gaze-laravel, and related PIInuts repositories. It does not govern `CHANGELOG.md` (which remains Keep a Changelog), commit messages, pull request descriptions, or marketing copy.

## Required structure

Keep this order and these headings. The opening paragraph and every section are required except **Known limitations**, which may be omitted only when the release has no relevant intentional gaps.

1. Opening paragraph (1–3 sentences): release identifier and bundle context, high-level changes, and a North Star tie in the opening or TL;DR: “fail closed, preserve reversibility, keep PII out of agent-visible surfaces” (or a faithful paraphrase).
2. `## TL;DR`: one dense prose paragraph, no bullets, covering the major changes, gates, and most important behavior shift.
3. `## Highlights`: one prose paragraph per major item, following: `[Feature/subsystem] landed in PR #N. [What it does] using [how]. [Why it matters to adopters or the trust contract.]` Keep inline PR anchors; stop at four highlights unless there are more distinct major items.
4. `## Known limitations`: describe accepted gaps honestly as intentional/documented risks. Include the relevant `docs/` page and follow-up todo number or planned-fix release.
5. `## Adopter notes`: list behavior changes and concrete migration recipes, repository/distribution moves, and exact platform or dependency constraints.
6. `## Download`: bullet list with each platform's binary URL and SHA256 sidecar URL. Order by adopter mass, starting with Apple Silicon macOS, then Linux x86_64.
7. `## Full CHANGELOG`: one line linking to the corresponding release section in `CHANGELOG.md`.

## Voice and accuracy

- Use past-tense, third-person prose. Subjects are artifacts and components (“the gate enforces”, “the recognizer validates”), not authors. Avoid “we”, “you”, “our”, and “your”.
- Anchor each highlight to a PR inline; do not put PR numbers in a footer.
- Preserve exact crate, flag, feature, error-type, and version names. Do not guess missing details; inspect the repository, PRs, or release artifacts, and mark unresolved facts for the user.
- Avoid marketing language, including “blazing”, “powerful”, “seamless”, “now you can”, “magic”, and “effortless”. Do not use emojis.
- Do not use Keep-a-Changelog headings such as `### Added` or `### Changed` in a GitHub release body, and do not paste generated changelog bullets back into the release notes.

## Workflow

When starting from auto-generated notes, treat them as source material: map substantive changes into a few coherent Highlights paragraphs, omit changes too small for release notes, and retain those details in `CHANGELOG.md`. Gather PR links, exact technical names, behavior changes, known limitations, downloads, checksums, and the changelog anchor before drafting. Never invent missing data.

## Pre-publish checklist

- Opening paragraph identifies the release and what it ships; North Star appears in opening or TL;DR.
- TL;DR is one paragraph without bullets; Highlights are past-tense prose with inline PR anchors and exact names.
- No first- or second-person voice, hype words, emojis, or Keep-a-Changelog section headings.
- Any intentional gaps have a `docs/` reference and a follow-up todo or planned-fix release.
- Adopter notes include every behavior shift and an actionable migration recipe; constraints use exact versions.
- Download lists each binary and its SHA256 sidecar; Full CHANGELOG points to the correct release anchor.
