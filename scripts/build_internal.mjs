#!/usr/bin/env node
// Encrypt the members-only material for publishing.
//
//   INTERNAL_PASSWORD='...' node scripts/build_internal.mjs
//
// internal/content.html (the page) is encrypted into internal.html, and each
// file in internal/files/ (presentations and so on) into assets/internal/<name>.enc.
// The internal/ folder holds plain text and is never committed (see .gitignore).
// Only the encrypted copies are published; without the password they cannot be read.
//
// To add a file: put it in internal/files/, link it from internal/content.html
// with <a href="#" data-file="<name>">, and run this script.
import { webcrypto as crypto } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const password = process.env.INTERNAL_PASSWORD;
if (!password) {
  console.error("Set INTERNAL_PASSWORD.");
  process.exit(1);
}

const iterations = 600000;
const deriveKey = async (salt, usage) => {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base, { name: "AES-GCM", length: 256 }, false, [usage]);
};
const seal = async (plain) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt, "encrypt");
  return { salt, iv, data: new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)) };
};

// The page, stored inside internal.html.
const b64 = (b) => Buffer.from(b).toString("base64");
const { salt, iv, data } = await seal(readFileSync(new URL("internal/content.html", root)));
const sealed = JSON.stringify({ iterations, salt: b64(salt), iv: b64(iv), data: b64(data) });
const page = new URL("internal.html", root);
const html = readFileSync(page, "utf8");
const marker = /(<script type="application\/json" id="sealed">)[^<]*(<\/script>)/;
if (!marker.test(html)) {
  console.error("Sealed-content marker not found in internal.html.");
  process.exit(1);
}
writeFileSync(page, html.replace(marker, (_, open, close) => open + sealed + close));
console.log("internal.html updated.");

// True if the published copy already holds these bytes under this password, so
// rebuilding doesn't rewrite large files and bloat the git history.
const unchanged = async (outPath, plain) => {
  if (!existsSync(outPath)) return false;
  const old = readFileSync(outPath);
  try {
    const key = await deriveKey(old.subarray(0, 16), "decrypt");
    const opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: old.subarray(16, 28) }, key, old.subarray(28));
    return Buffer.from(opened).equals(plain);
  } catch {
    return false;
  }
};

// The files: salt (16 bytes), then iv (12 bytes), then the ciphertext.
const sources = new URL("internal/files/", root);
const outDir = new URL("assets/internal/", root);
for (const name of existsSync(sources) ? readdirSync(sources) : []) {
  if (name.startsWith(".")) continue;
  const plain = readFileSync(new URL(encodeURIComponent(name), sources));
  const outPath = new URL(`${encodeURIComponent(name)}.enc`, outDir);
  if (await unchanged(outPath, plain)) {
    console.log(`${name}: unchanged.`);
    continue;
  }
  const file = await seal(plain);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, Buffer.concat([file.salt, file.iv, file.data]));
  console.log(`${name}: encrypted.`);
}
