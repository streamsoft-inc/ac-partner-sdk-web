import { AcSdkError } from "../errors.js";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** Creates a PKCE verifier and its S256 challenge. */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomUrlSafe(64);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

/** Opaque CSRF token echoed back on the redirect. */
export function randomState(): string {
  return randomUrlSafe(16);
}

function randomUrlSafe(bytes: number): string {
  const array = new Uint8Array(bytes);
  getCrypto().getRandomValues(array);
  return base64UrlEncode(array);
}

async function sha256Base64Url(input: string): Promise<string> {
  const subtle = getCrypto().subtle;
  if (!subtle) {
    throw new AcSdkError("Web Crypto (crypto.subtle) is unavailable. PKCE requires a secure context (HTTPS or localhost).");
  }
  const data = new TextEncoder().encode(input);
  const digest = await subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new AcSdkError("No Web Crypto available. The AC SDK runs in a browser (secure context).");
  }
  return c;
}
