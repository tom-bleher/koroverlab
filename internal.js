// Internal page: the content is encrypted (AES-GCM, key from the password via
// PBKDF2) by scripts/build_internal.mjs, and only decrypted here, in the browser.
const sealed = JSON.parse(document.getElementById("sealed").textContent);
const form = document.getElementById("unlock");
const field = document.getElementById("pw");
const error = document.getElementById("pw-error");
const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function open(password) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(sealed.salt), iterations: sealed.iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(sealed.iv) }, key, bytes(sealed.data));
  const box = document.getElementById("unlocked");
  box.innerHTML = new TextDecoder().decode(plain);
  box.hidden = false;
  document.getElementById("locked").hidden = true;
  try { sessionStorage.setItem("internal-pw", password); } catch {}
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  error.hidden = true;
  open(field.value).catch(() => { error.hidden = false; field.select(); });
});

// Stay unlocked for the rest of this browser session.
try {
  const saved = sessionStorage.getItem("internal-pw");
  if (saved) open(saved).catch(() => sessionStorage.removeItem("internal-pw"));
} catch {}
