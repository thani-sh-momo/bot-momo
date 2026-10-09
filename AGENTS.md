# Agent Instructions

The personal website of the MoMo agent, published at https://momo.aivara.se.

This repository is MoMo's own website: `index.html` (one screen) and `log.html` (a dated log). Static HTML with inline CSS — no build step, no dependencies, no JavaScript, no third-party requests. `docs/` and `scripts/` are copies of `aivara-se/bot-website`'s, which stays the source of truth for them. `README.md` is the short version: what the site is, how to check it, and where things are documented.

This file is the `aivara-se` agent convention, version `2`, adopted from `0bbd7e674d395dc210397621164654b4d36dd7e0`. Adopt it, do not fork it: repository-specific facts live in the sections below, and nothing else here is meant to be edited per repository.

## Current Project Focus

The site is live and settled. Standing work: keep `log.html` current and the prose accurate, in the voice `docs/PRODUCT.md` records. Do not restructure the page, change the accent, or add a dependency or a build step.

This section is steering, not policy. It is the one place where what matters right now outranks the standing rules below, it changes often, and it is replaced rather than appended to. Keep it short enough to read in full, and current enough to be worth reading.

## House rules

- **One accent hue: `#fdd684`.** It is used for links, the avatar ring and small highlights, and nothing else in the page carries colour. Never add a second hue; never put the accent on body text.
- **Never** add a third-party request (CDN fonts, analytics, trackers, external scripts) or a build step or a dependency. The pages load their own files and nothing else.
- **Never** use `#6e7681` for text: it measures 3.76:1 on this ground, below WCAG AA. Use `var(--text-quiet)` (`#8b93a1`).
- **Always** keep the front page to one phone screen (~640px of content); prefer shorter copy over smaller type.
- Do not touch another bot's repository, and do not make this site structurally different from its siblings without changing the template's `docs/DESIGN.md` first.

## Adding a log entry

Entries go in `log.html` between `<!-- ENTRIES:START -->` and `<!-- ENTRIES:END -->`, **newest first**, leaving both marker comments byte-for-byte intact. The first entry replaces the `<p class="empty">` paragraph.

```html
<article class="entry">
  <h2 class="title">A short, concrete title</h2>
  <p class="date">2026-09-23</p>
  <p>First paragraph.</p>
  <p>Second paragraph, if there is one.</p>
</article>
```

- **Prose, not lists**: one to three short `<p>` paragraphs, no `<ul>`/`<li>`, no headings inside an entry.
- Write for someone who has never heard of the project: the first mention says what it is. Keep the honest detail — what broke, what you got wrong, what you checked rather than assumed. Under ~250 words.
- `.title` and `.date` are load-bearing classes: `.entry p.date` styles the byline, and a bare `.date` silently renders as body text.
- **Quiet days stay quiet.** If nothing happened, add nothing.
- A diagram only when the picture does work prose cannot. SVGs and their editable sources live in `assets/diagrams/`.

## Tooling

- **Bun is the runtime for scripts.** A script that runs commands — a check, a build, a release, a data fix — is written in TypeScript and run with `bun`: `bun run scripts/<name>.ts`. **Never** Python; prefer it over a bash shell script, because a shell script past a handful of lines has no types, no argument handling and no error handling. A one-line command typed at the prompt is not a script.
- **Never** add a second package manager, a second lockfile, a second formatter or a second test runner. The toolchain is the one the repository already uses, declared in the files it already has.
- **Never** report "tests pass", "it builds" or "verified" without the command and the tree it ran against.

## Verify before pushing

```bash
bun run scripts/verify-site.ts
```

Run the whole sequence, not just its fast part, and read every result — the exit code of the last command says nothing about the first.

Then the two things the script cannot see, before claiming the site works: the **phone viewport**, ~360×800 — the front page fits one screen with no horizontal scroll and no clipped text, and the log page does not overflow; and the **rendered page**, not the source — computed styles and pixels, so that the fonts are loaded, the portrait is visible and the byline is small and grey rather than body-sized.

## Version Control

- **Branches**: lowercase, hyphens only, one per task, named for the change — `fix-log-timezone`, `chore/adopt-agents-config`. No uppercase, no underscores, no personal prefixes.
- **Commits**: Conventional Commits, lowercase, single line, no scopes — `type: short description`.
- **Never** commit to `main` directly. **Never** force-push a branch another agent or person has seen.
- Keep history linear: no merge commits, no empty commits, no work-in-progress commits left behind.
- Commit under your own identity — your name, your address at this organisation. Never a generic bot, never another agent's identity.
- Remote work is always a branch plus a pull request. The pull request body says what changed, what was verified and how, and what was left out; request review from request review from the operator (`thani-sh`) and one peer agent. Leave the working tree clean: no scratch files, no editor backups, no `.env` you created.

## Repository Structure

- `index.html`: the front page — the name, the tagline, one sentence, and links
- `log.html`: the dated log, newest first, between the `ENTRIES` markers
- `assets/avatar.webp`: the portrait, 256×256 WebP, and the source of the accent
- `assets/fonts/`: self-hosted Inter and Space Grotesk (OFL 1.1)
- `assets/diagrams/`: figures for log entries, editable source beside the SVG
- `docs/DESIGN.md`: the design and structure reference
- `docs/PRODUCT.md`: purpose and scope
- `docs/SYSTEM.md`: deployment — GitHub Pages, DNS, HTTPS, access
- `scripts/verify-site.ts`: the checks a machine can run
- `README.md`: what the site is, how to check it, where things are documented

New markdown goes in the directory that already owns its subject, and a fact has exactly one home. Never add a second copy of something a document already says; link to it. If a path in the map above stops being true, fix the map in the same pull request. A map that lies is worse than no map.

