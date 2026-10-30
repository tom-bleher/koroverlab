#!/usr/bin/env node
// Encrypt internal/content.html into internal.html.
//
//   INTERNAL_PASSWORD='...' node scripts/build_internal.mjs
//
// internal/content.html holds the members-only page in plain text and is never
// committed (see .gitignore). Only the encrypted copy in internal.html is
// published; without the password it cannot be read.
import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const password = process.env.INTERNAL_PASSWORD;
if (!password) {
  console.error("Set INTERNAL_PASSWORD.");
  process.exit(1);
}

const iterations = 600000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const content = readFileSync(new URL("internal/content.html", root));
const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, content));

const b64 = (b) => Buffer.from(b).toString("base64");
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
