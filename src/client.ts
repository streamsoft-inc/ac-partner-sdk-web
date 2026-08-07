import { OAuthClient, type ConnectOptions } from "./auth/oauthClient.js";
import { LocalTokenStorage, type TokenStorage } from "./auth/tokenStore.js";
import { ContentClient } from "./content/contentClient.js";
import type {
  Album,
  AlbumsQuery,
  AlbumTracksQuery,
  Artist,
  ArtistAlbumsQuery,
  ArtistsQuery,
  FacetValue,
  Page,
  PingResponse,
  PlaybackEvent,
  PlaybackUrl,
  SearchQuery,
  SearchResult,
  Studio,
  Track,
  UserProfile,
} from "./content/types.js";
import { AcSdkError } from "./errors.js";
import { ApiClient } from "./http/apiClient.js";

const DEFAULT_API_BASE_URL = "https://api-partners.prod.artistconnection.net";
const DEFAULT_CONSENT_URL = "https://music.artistconnection.net/connect";
const DEFAULT_PLATFORM = "web";

export interface AcPartnerClientConfig {
  /** Your public client id (issued by AC). Not a secret. */
  clientId: string;
  /** A redirect URI registered with AC (exact match), e.g. your app URL. */
  redirectUri: string;
  /** AC Partner API base URL. Defaults to production. */
  apiBaseUrl?: string;
  /**
   * Consent page URL. Defaults to the Artist Connection portal; use
   * `https://music.pureaudiostreaming.com/connect` for Pure Audio Streaming.
   */
  consentUrl?: string;
  /** Scopes to request. Defaults to all scopes granted to your integration. */
  scopes?: string[];
  /** Value for the mandatory `X-AC-Platform` header. Defaults to `"web"`. */
  platform?: string;
  /** Custom fetch implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /** Token storage. Defaults to `localStorage` (persists across reloads). */
  storage?: TokenStorage;
  /**
   * Whether `init()` should automatically complete the OAuth redirect when the
   * current URL carries `code`/`error`. Defaults to `true`.
   */
  autoHandleRedirect?: boolean;
}

/**
 * Entry point for the AC Partner SDK — a fully browser-side, public-client
 * (Authorization Code + PKCE) integration. No backend, no client secret.
 *
 * ```ts
 * // app startup:
 * await AcPartnerClient.init({
 *   clientId: "partner_acme",
 *   redirectUri: window.location.origin,   // registered with AC
 *   consentUrl: "https://music.pureaudiostreaming.com/connect",
 * });
 *
 * // sign-in button:
 * if (!AcPartnerClient.isAuthenticated()) await AcPartnerClient.connect();
 *
 * // once signed in:
 * const albums = await AcPartnerClient.getAlbums({ limit: 50 });
 * ```
 */
export class AcPartnerClient {
  private readonly oauth: OAuthClient;
  private readonly content: ContentClient;

  private static instance: AcPartnerClient | null = null;

  constructor(config: AcPartnerClientConfig) {
    if (!config.clientId) throw new AcSdkError("`clientId` is required.");
    if (!config.redirectUri) throw new AcSdkError("`redirectUri` is required.");

    const fetchImpl = config.fetch ?? resolveGlobalFetch();
    const apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    const storage = config.storage ?? new LocalTokenStorage();

    this.oauth = new OAuthClient({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      apiBaseUrl,
      consentUrl: config.consentUrl ?? DEFAULT_CONSENT_URL,
      scopes: config.scopes,
      fetchImpl,
      storage,
    });

    const api = new ApiClient({
      apiBaseUrl,
      oauth: this.oauth,
      fetchImpl,
      timeoutMs: config.timeoutMs ?? 30_000,
      platform: config.platform ?? DEFAULT_PLATFORM,
    });
    this.content = new ContentClient(api);
  }

  // ---- authentication -----------------------------------------------------

  /** Returns the consent URL without navigating (advanced). */
  getAuthorizationUrl(options?: ConnectOptions): Promise<string> {
    return this.oauth.createAuthorizationUrl(options);
  }

  /** Starts sign-in by redirecting the browser to the AC consent page. */
  async connect(options?: ConnectOptions): Promise<void> {
    const url = await this.oauth.createAuthorizationUrl(options);
    getWindow().location.assign(url);
  }

  /** True when the current URL is an OAuth redirect (`code`/`error` present). */
  isRedirectPending(): boolean {
    return this.oauth.hasRedirectParams(getWindow().location.search);
  }

  /**
   * Completes the OAuth redirect: exchanges the code for tokens and cleans the
   * `code`/`state` params out of the URL. Call on app load when returning from
   * consent (or let `init` do it automatically).
   */
  async handleRedirectCallback(): Promise<void> {
    await this.oauth.completeAuthorization(getWindow().location.search);
    cleanRedirectParamsFromUrl();
  }

  /** Whether a usable session exists (valid access token or a refresh token). */
  isAuthenticated(): boolean {
    return this.oauth.isAuthenticated();
  }

  /** Clears the stored session. */
  logout(): void {
    this.oauth.logout();
  }

  /** Returns a valid access token, refreshing if needed (advanced). */
  getAccessToken(): Promise<string> {
    return this.oauth.getAccessToken();
  }

  // ---- content ------------------------------------------------------------

  ping(): Promise<PingResponse> {
    return this.content.ping();
  }
  getStudio(): Promise<Studio> {
    return this.content.getStudio();
  }
  getUser(): Promise<UserProfile> {
    return this.content.getUser();
  }
  getAlbums(query?: AlbumsQuery): Promise<Page<Album>> {
    return this.content.getAlbums(query);
  }
  getArtists(query?: ArtistsQuery): Promise<Page<Artist>> {
    return this.content.getArtists(query);
  }
  getArtistAlbums(artistId: string, query?: ArtistAlbumsQuery): Promise<Page<Album>> {
    return this.content.getArtistAlbums(artistId, query);
  }
  getGenres(): Promise<FacetValue[]> {
    return this.content.getGenres();
  }
  getFormats(): Promise<FacetValue[]> {
    return this.content.getFormats();
  }
  getLabels(): Promise<FacetValue[]> {
    return this.content.getLabels();
  }
  getAlbumTracks(albumUuid: string, query?: AlbumTracksQuery): Promise<Track[]> {
    return this.content.getAlbumTracks(albumUuid, query);
  }
  getTrack(albumUuid: string, trackId: string): Promise<Track> {
    return this.content.getTrack(albumUuid, trackId);
  }
  getAlbumPlayback(albumUuid: string): Promise<PlaybackUrl[]> {
    return this.content.getAlbumPlayback(albumUuid);
  }
  getTrackPlayback(albumUuid: string, trackId: string): Promise<PlaybackUrl> {
    return this.content.getTrackPlayback(albumUuid, trackId);
  }
  search(query: SearchQuery): Promise<SearchResult> {
    return this.content.search(query);
  }
  getFavoriteAlbums(): Promise<Album[]> {
    return this.content.getFavoriteAlbums();
  }
  addFavoriteAlbum(albumUuid: string): Promise<void> {
    return this.content.addFavoriteAlbum(albumUuid);
  }
  removeFavoriteAlbum(albumUuid: string): Promise<void> {
    return this.content.removeFavoriteAlbum(albumUuid);
  }
  reportPlaybackEvents(events: PlaybackEvent[]): Promise<void> {
    return this.content.reportPlaybackEvents(events);
  }

  // ---- static facade over the shared instance -----------------------------

  /**
   * Initializes the shared SDK instance. Call once at app startup. If the
   * current URL is an OAuth redirect, it completes sign-in automatically
   * (unless `autoHandleRedirect: false`).
   */
  static async init(config: AcPartnerClientConfig): Promise<AcPartnerClient> {
    const client = new AcPartnerClient(config);
    AcPartnerClient.instance = client;
    if (config.autoHandleRedirect !== false && client.isRedirectPending()) {
      await client.handleRedirectCallback();
    }
    return client;
  }

  /** Returns the shared instance created by {@link AcPartnerClient.init}. */
  static getInstance(): AcPartnerClient {
    if (!AcPartnerClient.instance) {
      throw new AcSdkError("AcPartnerClient is not initialized. Call AcPartnerClient.init(config) at app startup.");
    }
    return AcPartnerClient.instance;
  }

  static getAuthorizationUrl(options?: ConnectOptions): Promise<string> {
    return AcPartnerClient.getInstance().getAuthorizationUrl(options);
  }
  static connect(options?: ConnectOptions): Promise<void> {
    return AcPartnerClient.getInstance().connect(options);
  }
  static isRedirectPending(): boolean {
    return AcPartnerClient.getInstance().isRedirectPending();
  }
  static handleRedirectCallback(): Promise<void> {
    return AcPartnerClient.getInstance().handleRedirectCallback();
  }
  static isAuthenticated(): boolean {
    return AcPartnerClient.getInstance().isAuthenticated();
  }
  static logout(): void {
    return AcPartnerClient.getInstance().logout();
  }
  static getAccessToken(): Promise<string> {
    return AcPartnerClient.getInstance().getAccessToken();
  }
  static ping(): Promise<PingResponse> {
    return AcPartnerClient.getInstance().ping();
  }
  static getStudio(): Promise<Studio> {
    return AcPartnerClient.getInstance().getStudio();
  }
  static getUser(): Promise<UserProfile> {
    return AcPartnerClient.getInstance().getUser();
  }
  static getAlbums(query?: AlbumsQuery): Promise<Page<Album>> {
    return AcPartnerClient.getInstance().getAlbums(query);
  }
  static getArtists(query?: ArtistsQuery): Promise<Page<Artist>> {
    return AcPartnerClient.getInstance().getArtists(query);
  }
  static getArtistAlbums(artistId: string, query?: ArtistAlbumsQuery): Promise<Page<Album>> {
    return AcPartnerClient.getInstance().getArtistAlbums(artistId, query);
  }
  static getGenres(): Promise<FacetValue[]> {
    return AcPartnerClient.getInstance().getGenres();
  }
  static getFormats(): Promise<FacetValue[]> {
    return AcPartnerClient.getInstance().getFormats();
  }
  static getLabels(): Promise<FacetValue[]> {
    return AcPartnerClient.getInstance().getLabels();
  }
  static getAlbumTracks(albumUuid: string, query?: AlbumTracksQuery): Promise<Track[]> {
    return AcPartnerClient.getInstance().getAlbumTracks(albumUuid, query);
  }
  static getTrack(albumUuid: string, trackId: string): Promise<Track> {
    return AcPartnerClient.getInstance().getTrack(albumUuid, trackId);
  }
  static getAlbumPlayback(albumUuid: string): Promise<PlaybackUrl[]> {
    return AcPartnerClient.getInstance().getAlbumPlayback(albumUuid);
  }
  static getTrackPlayback(albumUuid: string, trackId: string): Promise<PlaybackUrl> {
    return AcPartnerClient.getInstance().getTrackPlayback(albumUuid, trackId);
  }
  static search(query: SearchQuery): Promise<SearchResult> {
    return AcPartnerClient.getInstance().search(query);
  }
  static getFavoriteAlbums(): Promise<Album[]> {
    return AcPartnerClient.getInstance().getFavoriteAlbums();
  }
  static addFavoriteAlbum(albumUuid: string): Promise<void> {
    return AcPartnerClient.getInstance().addFavoriteAlbum(albumUuid);
  }
  static removeFavoriteAlbum(albumUuid: string): Promise<void> {
    return AcPartnerClient.getInstance().removeFavoriteAlbum(albumUuid);
  }
  static reportPlaybackEvents(events: PlaybackEvent[]): Promise<void> {
    return AcPartnerClient.getInstance().reportPlaybackEvents(events);
  }
}

function resolveGlobalFetch(): typeof fetch {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new AcSdkError("No global `fetch` found. Provide a `fetch` implementation in the config.");
}

function getWindow(): Window {
  if (typeof window === "undefined") {
    throw new AcSdkError("This operation requires a browser (window is undefined).");
  }
  return window;
}

/** Strips `code`/`state`/`error` from the URL after completing the redirect. */
function cleanRedirectParamsFromUrl(): void {
  const win = getWindow();
  if (!win.history?.replaceState) return;
  const url = new URL(win.location.href);
  let changed = false;
  for (const key of ["code", "state", "error", "error_description"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    win.history.replaceState({}, "", url.toString());
  }
}
