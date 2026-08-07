/** Tokens persisted between page loads. Access + refresh live in the browser. */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scope: string | null;
  /** Epoch milliseconds at which the access token expires. */
  expiresAt: number;
}

/** Pluggable storage for tokens. Default is localStorage; pass your own for
 * in-memory or more secure storage. */
export interface TokenStorage {
  get(): StoredTokens | null;
  set(tokens: StoredTokens): void;
  clear(): void;
}

/** Default storage backed by `localStorage` (persists across reloads/tabs). */
export class LocalTokenStorage implements TokenStorage {
  constructor(private readonly key = "ac_partner_tokens") {}

  get(): StoredTokens | null {
    try {
      const raw = globalThis.localStorage?.getItem(this.key);
      return raw ? (JSON.parse(raw) as StoredTokens) : null;
    } catch {
      return null;
    }
  }

  set(tokens: StoredTokens): void {
    try {
      globalThis.localStorage?.setItem(this.key, JSON.stringify(tokens));
    } catch {
      // Storage may be unavailable (private mode); tokens then live only in memory.
    }
  }

  clear(): void {
    try {
      globalThis.localStorage?.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

/** Non-persistent storage; tokens are lost on reload. */
export class MemoryTokenStorage implements TokenStorage {
  private tokens: StoredTokens | null = null;
  get(): StoredTokens | null {
    return this.tokens;
  }
  set(tokens: StoredTokens): void {
    this.tokens = tokens;
  }
  clear(): void {
    this.tokens = null;
  }
}
