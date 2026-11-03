// Internal page: the content and files are encrypted (AES-GCM, key from the password
// via PBKDF2) by scripts/build_internal.mjs, and only decrypted here, in the browser.
const sealed = JSON.parse(document.getElementById("sealed").textContent);
const form = document.getElementById("unlock");
const field = document.getElementById("pw");
const error = document.getElementById("pw-error");
const box = document.getElementById("unlocked");
const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function decrypt(password, salt, iv, data) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: sealed.iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
}

async function open(password) {
  const plain = await decrypt(password, bytes(sealed.salt), bytes(sealed.iv), bytes(sealed.data));
  box.innerHTML = new TextDecoder().decode(plain);
  box.hidden = false;
  document.getElementById("locked").hidden = true;
  box.onclick = (event) => {
    const link = event.target.closest("a[data-file]");
    if (link) {
      event.preventDefault();
      download(link, password);
    }
  };
  try { sessionStorage.setItem("internal-pw", password); } catch {}
}

// Links with data-file fetch the encrypted copy, decrypt it here and save it.
async function download(link, password) {
  if (link.hasAttribute("aria-busy")) return;
  link.setAttribute("aria-busy", "true");
  link.removeAttribute("data-failed");
  try {
    const name = link.dataset.file;
    const response = await fetch(`assets/internal/${encodeURIComponent(name)}.enc`);
    if (!response.ok) throw new Error(response.status);
    const file = new Uint8Array(await response.arrayBuffer());
    const plain = await decrypt(password, file.subarray(0, 16), file.subarray(16, 28), file.subarray(28));
    const url = URL.createObjectURL(new Blob([plain]));
    const save = document.createElement("a");
    save.href = url;
    save.download = name;
    save.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    link.setAttribute("data-failed", "");
  } finally {
    link.removeAttribute("aria-busy");
  }
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
