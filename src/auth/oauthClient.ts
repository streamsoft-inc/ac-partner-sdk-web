import { AcAuthError, AcSdkError } from "../errors.js";
import { createPkcePair, randomState } from "./pkce.js";
import type { StoredTokens, TokenStorage } from "./tokenStore.js";

/** sessionStorage key holding the in-flight PKCE verifier + state. */
const FLOW_KEY = "ac_partner_pkce_flow";
/** Refresh the access token this many ms before it actually expires. */
const EXPIRY_SKEW_MS = 30_000;

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  apiBaseUrl: string;
  consentUrl: string;
  scopes?: string[];
  fetchImpl: typeof fetch;
  storage: TokenStorage;
}

export interface ConnectOptions {
  /** Override the requested scopes for this authorization. */
  scopes?: string[];
  /** Provide your own CSRF state (defaults to a random value). */
  state?: string;
}

interface TokenApiResponse {
  access_token: string;
  refresh_token: string | null;
  token_type?: string;
  scope?: string | null;
  expires_in?: number;
}

/**
 * Public-client OAuth (Authorization Code + PKCE), run entirely in the browser.
 * No client secret. Tokens are stored via the injected {@link TokenStorage}.
 */
export class OAuthClient {
  private refreshInflight: Promise<StoredTokens> | null = null;

  constructor(private readonly config: OAuthConfig) {}

  /**
   * Builds the consent URL and stashes the PKCE verifier + state in
   * sessionStorage so the redirect can be completed on return.
   */
  async createAuthorizationUrl(options: ConnectOptions = {}): Promise<string> {
    const { verifier, challenge } = await createPkcePair();
    const state = options.state ?? randomState();
    getSessionStorage().setItem(FLOW_KEY, JSON.stringify({ verifier, state }));

    const url = new URL(this.config.consentUrl);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("state", state);
    const scopes = options.scopes ?? this.config.scopes;
    if (scopes?.length) url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  /** True when the current URL looks like an OAuth redirect (has code/error). */
  hasRedirectParams(search: string): boolean {
    const params = new URLSearchParams(search);
    return params.has("code") || params.has("error");
  }

  /** Exchanges the redirect's authorization code for tokens (and stores them). */
  async completeAuthorization(search: string): Promise<StoredTokens> {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    if (error) {
      clearFlow();
      throw new AcAuthError(`Authorization was denied or failed: ${error}.`);
    }

    const code = params.get("code");
    const returnedState = params.get("state");
    const flowRaw = getSessionStorage().getItem(FLOW_KEY);
    if (!code || !flowRaw) {
      throw new AcAuthError("Missing authorization code or PKCE flow state.");
    }
    const flow = JSON.parse(flowRaw) as { verifier: string; state: string };
    if (returnedState !== flow.state) {
      clearFlow();
      throw new AcAuthError("State mismatch — possible CSRF; aborting.");
    }

    const tokens = await this.tokenRequest({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: flow.verifier,
    });
    clearFlow();
    this.config.storage.set(tokens);
    return tokens;
  }

  isAuthenticated(): boolean {
    const tokens = this.config.storage.get();
    if (!tokens) return false;
    return Boolean(tokens.refreshToken) || Date.now() < tokens.expiresAt;
  }

  logout(): void {
    this.config.storage.clear();
  }

  /** Returns a valid access token, refreshing if it is near expiry. */
  async getAccessToken(): Promise<string> {
    const tokens = this.config.storage.get();
    if (!tokens) {
      throw new AcAuthError("Not authenticated. Call connect() first.");
    }
    if (Date.now() < tokens.expiresAt - EXPIRY_SKEW_MS) {
      return tokens.accessToken;
    }
    return (await this.refresh(tokens)).accessToken;
  }

  /** Forces a refresh (used after a 401). */
  async refreshTokens(): Promise<string> {
    const tokens = this.config.storage.get();
    if (!tokens) {
      throw new AcAuthError("Not authenticated. Call connect() first.");
    }
    return (await this.refresh(tokens)).accessToken;
  }

  private refresh(current: StoredTokens): Promise<StoredTokens> {
    if (!current.refreshToken) {
      this.config.storage.clear();
      return Promise.reject(new AcAuthError("Session expired; re-authentication required."));
    }
    if (!this.refreshInflight) {
      this.refreshInflight = this.tokenRequest({
        grant_type: "refresh_token",
        client_id: this.config.clientId,
        refresh_token: current.refreshToken,
      })
        .then((tokens) => {
          // AC may not rotate the refresh token; keep the existing one if so.
          if (!tokens.refreshToken) tokens.refreshToken = current.refreshToken;
          this.config.storage.set(tokens);
          return tokens;
        })
        .catch((error) => {
          // Refresh failed (revoked/expired) — the link is gone.
          this.config.storage.clear();
          throw error;
        })
        .finally(() => {
          this.refreshInflight = null;
        });
    }
    return this.refreshInflight;
  }

  private async tokenRequest(params: Record<string, string>): Promise<StoredTokens> {
    let response: Response;
    try {
      response = await this.config.fetchImpl(`${this.config.apiBaseUrl.replace(/\/+$/, "")}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams(params),
      });
    } catch (cause) {
      throw new AcAuthError("Failed to reach the AC token endpoint.", { cause });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AcAuthError(
        `Token request failed with status ${response.status}${body ? `: ${body}` : ""}.`,
        { status: response.status, body: parseMaybeJson(body) },
      );
    }

    const data = (await response.json()) as TokenApiResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      tokenType: data.token_type ?? "Bearer",
      scope: data.scope ?? null,
      expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
    };
  }
}

function clearFlow(): void {
  try {
    getSessionStorage().removeItem(FLOW_KEY);
  } catch {
    // ignore
  }
}

function parseMaybeJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getSessionStorage(): Storage {
  const storage = globalThis.sessionStorage;
  if (!storage) {
    throw new AcSdkError("sessionStorage is unavailable. The AC SDK runs in a browser.");
  }
  return storage;
}
