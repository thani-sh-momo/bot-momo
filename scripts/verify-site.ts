#!/usr/bin/env bun
// verify-site.ts — the rules from AGENTS.md and docs/DESIGN.md that a machine can check.
//
// Run it in a site repository (aivara-se/bot-mama, or one generated from this template):
//     bun run scripts/verify-site.ts
// It reports PASS/FAIL/WARN and exits non-zero if anything failed.
//
// NOTE: in the template repository itself this is *expected* to FAIL — the placeholders are
// unfilled and the avatar is still the placeholder portrait. Run it in a real site.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
process.chdir(root);

const PLACEHOLDER_AVATAR = "b267d25f521faf4f7634a9913bded3f3"; // the portrait shipped in the template
const GROUND = "#171834"; // lightest ground stop = worst case
const FAMILY: Record<string, string> = {
  "#fdd684": "MoMo (botGold)",
  "#7aede2": "MiMi (botCyan)",
  "#f7a8d8": "MaMa (botPink)",
  "#9fe6a6": "MeMe (botMint)",
};
const REJECTED_TIER = "#6e7681"; // fails AA on this ground (3.76:1)

const fails: string[] = [];
const warns: string[] = [];
const ok = (m: string) => console.log(`  \x1b[32mPASS\x1b[0m  ${m}`);
const bad = (m: string) => {
  console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
  fails.push(m);
};
const warn = (m: string) => {
  console.log(`  \x1b[33mWARN\x1b[0m  ${m}`);
  warns.push(m);
};
const head = (m: string) => console.log(`\n\x1b[1m${m}\x1b[0m`);

const lin = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const ratio = (fg: string, bg: string) => {
  const lum = (h: string) => {
    h = h.replace(/^#/, "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [a0, b0] = [lum(fg), lum(bg)];
  const a = Math.max(a0, b0);
  const b = Math.min(a0, b0);
  return (a + 0.05) / (b + 0.05);
};

const missing = ["index.html", "log.html"].filter((f) => !existsSync(f));
if (missing.length) {
  console.log(`  \x1b[31mFAIL\x1b[0m  not a site repository: missing ${missing.join(", ")}`);
  process.exit(1);
}
const pages: Record<string, string> = Object.fromEntries(
  ["index.html", "log.html"].map((f) => [f, readFileSync(f, "utf8")]),
);

// ---------------------------------------------------------------- placeholders
head("Placeholders");
const found = [
  ...new Set(
    Object.values(pages).flatMap((f) => [...f.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1])),
  ),
].sort();
if (found.length) {
  bad(`unfilled placeholders: ${found.map((t) => `{{${t}}}`).join(", ")}`);
} else {
  ok("no {{PLACEHOLDER}} left in either page");
}

// ---------------------------------------------------------------- assets & requests
head("Assets and third-party requests");
const refs = new Map<string, Set<string>>();
for (const [name, html] of Object.entries(pages)) {
  for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(url)) continue;
    /* A {{TOKEN}} in a link is not a path: the placeholder check above already
       reports it, and a generated site replaces it with an absolute URL before
       this runs. Reading it as a missing file doubles the complaint and names a
       file that was never meant to exist. */
    if (/\{\{[A-Z_]+\}\}/.test(url)) continue;
    const key = url.split("#")[0];
    if (!refs.has(key)) refs.set(key, new Set());
    refs.get(key)!.add(name);
  }
}
for (const [url, where] of [...refs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  if (existsSync(url)) ok(`${url} exists`);
  else bad(`${url} referenced by ${[...where].sort().join(", ")} does not exist`);
}

const foreign: string[] = [];
const FOREIGN_PATTERNS = [
  /src\s*=\s*"https?:\/\//i,
  /<link[^>]+rel\s*=\s*"stylesheet"[^>]+href\s*=\s*"https?:\/\//i,
  /@import/i,
  /fonts\.googleapis/i,
  /fonts\.gstatic/i,
  /googletagmanager/i,
  /google-analytics/i,
  /cdn\./i,
];
for (const [name, html] of Object.entries(pages)) {
  for (const pat of FOREIGN_PATTERNS) {
    for (const m of html.matchAll(new RegExp(pat.source, pat.flags.includes("i") ? "gi" : "g"))) {
      foreign.push(`${name}: ${m[0].slice(0, 48)}`);
    }
  }
}
if (foreign.length) {
  bad(`third-party resource request(s): ${[...new Set(foreign)].sort().join("; ")}`);
} else {
  ok("nothing is loaded from a third party (fonts are local)");
}

for (const f of ["assets/fonts/inter-latin.woff2", "assets/fonts/space-grotesk-latin.woff2"]) {
  if (existsSync(f) && statSync(f).size > 1000) ok(`font present (${Math.floor(statSync(f).size / 1024)} KB)`);
  else bad(`missing or empty font: ${f}`);
}
for (const f of ["assets/fonts/OFL-Inter.txt", "assets/fonts/OFL-SpaceGrotesk.txt"]) {
  if (existsSync(f)) ok(`licence present: ${f.split("/").pop()}`);
  else bad(`missing licence: ${f}`);
}

if (/<script/i.test(Object.values(pages).join(""))) {
  bad("a <script> tag is present — the sites ship zero JavaScript");
} else {
  ok("no <script> tag anywhere");
}

// ---------------------------------------------------------------- the log block
head("Log block");
const START = "<!-- ENTRIES:START -->";
const END = "<!-- ENTRIES:END -->";
const log = pages["log.html"];
const ns = log.split(START).length - 1;
const ne = log.split(END).length - 1;
if (ns === 1 && ne === 1 && log.indexOf(START) < log.indexOf(END)) {
  ok("exactly one ENTRIES:START / ENTRIES:END pair, in order");
} else {
  bad(`ENTRIES markers wrong: ${ns} start, ${ne} end (need exactly one of each, start first)`);
}

const block = ns === 1 && ne === 1 ? log.split(START, 2)[1].split(END, 1)[0] : "";
const entries = [...block.matchAll(/<article class="entry">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
const dates: string[] = [];
entries.forEach((e, i) => {
  const n = i + 1;
  const t = e.match(/<h2 class="title">([\s\S]+?)<\/h2>/);
  const d = e.match(/<p class="date">(\d{4}-\d{2}-\d{2})<\/p>/);
  if (!t) bad(`entry ${n}: missing <h2 class="title">`);
  if (!d) bad(`entry ${n}: missing <p class="date">YYYY-MM-DD</p> (a bare .date class renders as body text)`);
  else dates.push(d[1]);
  if (!/<p>(?!<)/.test(e)) bad(`entry ${n}: no <p> body paragraph`);
  for (const banned of ["<ul", "<ol", "<li", "<h1", "<h3", "<h4"]) {
    if (e.toLowerCase().includes(banned))
      bad(`entry ${n}: contains ${banned} — entries are prose, not lists or nested headings`);
  }
});
const newestFirst = JSON.stringify(dates) === JSON.stringify([...dates].sort().reverse());
if (entries.length) {
  ok(
    newestFirst
      ? `${entries.length} log entr${entries.length === 1 ? "y" : "ies"}, newest first`
      : "log entries present",
  );
  if (!newestFirst) bad(`entries are not newest-first: ${dates.join(", ")}`);
  if (block.includes('class="empty"'))
    bad("the empty-state paragraph is still there alongside real entries — the first entry replaces it");
  else ok("empty state removed, as it must be once entries exist");
} else {
  ok("no entries yet");
  if (!block.includes('class="empty"')) warn("no entries and no empty state — the log page will look unfinished");
}

// ---------------------------------------------------------------- header
head("Header");
const H_START = "<!-- HEADER:START -->";
const H_END = "<!-- HEADER:END -->";
const headerOf = (h: string): string | null => {
  const parts = h.split(H_START);
  if (parts.length !== 2) return null;
  const inner = parts[1].split(H_END);
  return inner.length === 2 ? inner[0] : null;
};
const headers = Object.fromEntries(Object.entries(pages).map(([f, h]) => [f, headerOf(h)]));
const noHeader = Object.entries(headers).filter(([, v]) => v === null).map(([f]) => f);
if (noHeader.length) bad(`no single HEADER:START / HEADER:END pair in ${noHeader.join(", ")}`);
else if (headers["index.html"] !== headers["log.html"])
  bad("the two pages' header blocks differ — the header is the same block on every page");
else {
  ok("both pages carry the identical header block");
  const avatar = /class="portrait"[\s\S]*?<img[^>]*>/.exec(headers["index.html"]!)?.[0] ?? "";
  if (!avatar) bad("the header carries no avatar");
  else if (!/width="24"[^>]*height="24"/.test(avatar))
    bad("the header's avatar is not 24x24 — the size is on the img, not only in the CSS");
  else ok("the header carries the 24x24 avatar");
  if (/class="icon"/.test(headers["index.html"]!))
    bad("the header carries a GitHub mark again — the header is the avatar and two links, nothing else");
  else ok("the header carries no GitHub mark");
}
if (/class="back"/.test(pages["log.html"])) bad("log.html still has a back link — the header replaced it");
else ok("no back link on the log page");
for (const [f, h] of Object.entries(pages)) {
  if (!/\.top\s*\{[^}]*\bleft:/s.test(h)) bad(`${f}: .top does not set left — the avatar is at the left of the line`);
  if (!/\.top\s+\.portrait\s*\{[^}]*conic-gradient/s.test(h))
    bad(`${f}: .top .portrait has no conic-gradient — the avatar's ring is the front page's`);
}
if (Object.values(pages).every((h) => /\.top\s*\{[^}]*\bleft:/s.test(h) && /\.top\s+\.portrait\s*\{[^}]*conic-gradient/s.test(h)))
  ok("both pages put the header at the left and ring the avatar");
const posOf = (h: string) => /\.top\s*\{[^}]*position:\s*([a-z]+)/s.exec(h)?.[1] ?? null;
const bareTop = (h: string) => !/\.top\s*\{[^}]*background/s.test(h) && !/\.top\s+\.links\s*\{[^}]*background/s.test(h);
for (const [f, h] of Object.entries(pages)) {
  if (posOf(h) !== "absolute")
    bad(`${f}: .top is ${posOf(h) ?? "not positioned"} — it must be absolute, so the header leaves with the page instead of staying fixed over it`);
  if (!bareTop(h))
    bad(`${f}: the header carries a background — the links are bare, the same style on every page`);
}
if (Object.values(pages).every((h) => posOf(h) === "absolute" && bareTop(h)))
  ok("the header is absolute and its links bare on both pages");

// ---------------------------------------------------------------- colour
head("Colour");
const accents: Record<string, string | null> = Object.fromEntries(
  Object.entries(pages).map(([f, h]) => [f, h.match(/--accent:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? null]),
);
const values = new Set(Object.values(accents).filter((v): v is string => Boolean(v)));
if (!values.size) {
  bad("--accent is not set to a hex colour in either page (still a placeholder?)");
} else if (values.size !== 1) {
  bad(`the two pages disagree about the accent: ${JSON.stringify(accents)}`);
} else {
  const acc = [...values][0].toLowerCase();
  const r = ratio(acc, GROUND);
  const role = FAMILY[acc];
  if (r >= 4.5) ok(`accent ${acc} measures ${r.toFixed(2)}:1 against the ground (AA needs 4.5)`);
  else bad(`accent ${acc} measures only ${r.toFixed(2)}:1 against the ground — fails AA`);
  if (role) ok(`accent is a family token: ${role}`);
  else
    warn(
      `accent ${acc} is not one of the four family tokens — a new bot needs its hue ` +
        `registered in aivara.se's design tokens and DESIGN.md at the same time`,
    );
}

for (const [f, h] of Object.entries(pages)) {
  if (h.toLowerCase().includes(REJECTED_TIER))
    bad(`${f} still uses ${REJECTED_TIER} — that tier measures 3.76:1 here; use var(--text-quiet)`);
  if (!/^\s*a\s*\{/m.test(h))
    bad(
      `${f} has no global 'a { ... }' rule — an anchor in new copy would fall back to ` +
        `the browser's default blue, far below AA on this ground`,
    );
}

// ---------------------------------------------------------------- avatar & scaffolding
head("Portrait and scaffolding");
if (!existsSync("assets/avatar.webp")) {
  bad("assets/avatar.webp is missing");
} else {
  const d = readFileSync("assets/avatar.webp");
  if (d.subarray(0, 4).toString("latin1") !== "RIFF" || d.subarray(8, 12).toString("latin1") !== "WEBP") {
    bad("assets/avatar.webp is not a WebP file");
  } else {
    const chunk = d.subarray(12, 16).toString("latin1");
    let w = 0;
    let h = 0;
    if (chunk === "VP8 ") {
      w = d.readUInt16LE(26) & 0x3fff;
      h = d.readUInt16LE(28) & 0x3fff;
    } else if (chunk === "VP8L") {
      const b = d.readUInt32LE(21);
      w = (b & 0x3fff) + 1;
      h = ((b >> 14) & 0x3fff) + 1;
    } else if (chunk === "VP8X") {
      w = d.readUIntLE(24, 3) + 1;
      h = d.readUIntLE(27, 3) + 1;
    }
    if (w === 256 && h === 256) ok("avatar is 256x256 WebP");
    else bad(`avatar is ${w}x${h} — must be 256x256 WebP (and small: keep it under ~40 KB)`);
    if (createHash("md5").update(d).digest("hex") === PLACEHOLDER_AVATAR)
      bad("assets/avatar.webp is still the template's placeholder portrait — replace it with this bot's own");
    else
      ok(
        `avatar is this bot's own (${Math.floor(statSync("assets/avatar.webp").size / 1024)} KB or less: ` +
          `${statSync("assets/avatar.webp").size} B)`,
      );
  }
}

if (existsSync(".nojekyll")) ok(".nojekyll present (Jekyll off)");
else warn(".nojekyll missing — add it so files with a leading underscore are served");

const origin = pages["index.html"].match(/<meta property="og:url" content="([^"]+)"/);
if (existsSync("CNAME")) {
  const cname = readFileSync("CNAME", "utf8").trim();
  const host = origin ? origin[1].split("//").pop()!.replace(/\/+$/, "") : "";
  if (cname === host) ok(`CNAME matches og:url: ${cname}`);
  else bad(`CNAME says ${JSON.stringify(cname)} but og:url points at ${JSON.stringify(host)} — they must match`);
} else {
  warn("no CNAME file yet — correct while DNS is pending; add it after the record resolves (docs/SYSTEM.md §3)");
}

// ---------------------------------------------------------------- summary
console.log();
if (fails.length) {
  console.log(`\x1b[31m${fails.length} check(s) failed\x1b[0m` + (warns.length ? `, ${warns.length} warning(s)` : ""));
  process.exit(1);
}
console.log(`\x1b[32mall checks passed\x1b[0m` + (warns.length ? `, ${warns.length} warning(s)` : ""));
