"use client";

// Cifrado en reposo para secretos locales (Clave Fiscal AFIP). AES-GCM 256 con una clave
// NO extraíble guardada en IndexedDB: aunque alguien copie el localStorage (backup del perfil,
// equipo compartido, sync del navegador), el texto cifrado es inútil sin la clave del
// dispositivo. No defiende contra un XSS activo (podría invocar descifrarSecreto), pero eleva
// la barrera frente a los vectores realistas: volcado estático de localStorage / acceso físico.
// Degrada con elegancia: sin WebCrypto/IndexedDB, guarda/lee en claro (no rompe el bot).

const PREFIJO = "enc:v1:";
const DB_NAME = "caravanas-sec";
const STORE = "keys";
const KEY_ID = "afip";

function hayCrypto(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    !!globalThis.crypto?.subtle &&
    typeof indexedDB !== "undefined"
  );
}

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, id: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, id: string, val: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let cacheKey: CryptoKey | null = null;

async function obtenerClave(): Promise<CryptoKey> {
  if (cacheKey) return cacheKey;
  const db = await abrirDB();
  let key = (await idbGet(db, KEY_ID)) as CryptoKey | undefined;
  if (!key) {
    // generateKey con extractable=false: la CryptoKey vive en IndexedDB pero su material
    // nunca puede exportarse a JS (no se puede exfiltrar el secreto de cifrado).
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await idbPut(db, KEY_ID, key);
  }
  cacheKey = key;
  return key;
}

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function deB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length); // ArrayBuffer explícito (no ArrayBufferLike)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function cifrarSecreto(texto: string): Promise<string> {
  if (!texto || !hayCrypto()) return texto; // sin crypto: se guarda tal cual (degradación)
  try {
    const key = await obtenerClave();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(texto)
    );
    return `${PREFIJO}${b64(iv.buffer)}:${b64(ct)}`;
  } catch {
    return texto;
  }
}

export async function descifrarSecreto(valor: string | undefined): Promise<string> {
  if (!valor) return "";
  if (!valor.startsWith(PREFIJO)) return valor; // compat: claves en claro guardadas antes
  if (!hayCrypto()) return "";
  try {
    const [ivB64, ctB64] = valor.slice(PREFIJO.length).split(":");
    const key = await obtenerClave();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deB64(ivB64) },
      key,
      deB64(ctB64)
    );
    return new TextDecoder().decode(pt);
  } catch {
    return "";
  }
}
