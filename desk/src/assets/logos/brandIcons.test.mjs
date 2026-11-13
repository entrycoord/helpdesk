import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// One icon set: the sidebar logo (HDLogo.vue), favicon.svg, the add_to_apps_screen
// logo and the PWA/splash images all come from the same artwork (indigo chat bubble).
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const favicon = read("../../../public/favicon.svg");
const hdLogo = read("./HDLogo.vue");
const githubLogo = read("../../../../.github/hd-logo.svg");
const hooks = read("../../../../helpdesk/hooks.py");

const paths = (s) =>
  [...s.matchAll(/<(?:path|circle|rect)[^>]*>/g)].map((m) => m[0]);
const normalise = (tag) =>
  tag
    .replace(/\s+/g, " ")
    .replace(/\s*\/>$/, ">")
    .replace(/>$/, "")
    .replace(/ >/, ">")
    .replace(/\s+$/, "");

test("sidebar logo has exactly the favicon artwork", () => {
  const a = paths(favicon).map(normalise);
  const b = paths(hdLogo).map(normalise);
  assert.equal(a.length, 5);
  assert.deepEqual(b, a);
});

test("github logo is the favicon", () => {
  assert.equal(githubLogo, favicon);
});

test("favicon uses the indigo bubble, no old slate colour or upstream purple", () => {
  assert.match(favicon, /#4f46e5/i);
  for (const s of [favicon, hdLogo, githubLogo]) {
    assert.doesNotMatch(s, /#475569|#7D42FB|#F8FAFC/i);
  }
});

test("apps screen hook points at the favicon", () => {
  assert.match(hooks, /"logo": "\/assets\/helpdesk\/desk\/favicon\.svg"/);
});

function pngSize(name) {
  const b = readFileSync(
    new URL(`../../../public/manifest/${name}`, import.meta.url)
  );
  assert.equal(b.subarray(1, 4).toString(), "PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20), b[24], b[25]];
}

test("maskable / apple icons are opaque RGB PNGs of the right size", () => {
  assert.deepEqual(pngSize("manifest-icon-192.maskable.png"), [192, 192, 8, 2]);
  assert.deepEqual(pngSize("manifest-icon-512.maskable.png"), [512, 512, 8, 2]);
  assert.deepEqual(pngSize("apple-icon-180.png"), [180, 180, 8, 2]);
});

test("every splash image referenced by index.html exists", () => {
  const html = read("../../../index.html");
  const refs = [...html.matchAll(/manifest\/(apple-splash-[\d-]+\.jpg)/g)].map(
    (m) => m[1]
  );
  const files = new Set(
    readdirSync(new URL("../../../public/manifest/", import.meta.url))
  );
  assert.ok(refs.length >= 30);
  for (const r of refs) assert.ok(files.has(r), r);
});
