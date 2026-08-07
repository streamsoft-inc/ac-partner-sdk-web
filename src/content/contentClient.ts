import { AcSdkError } from "../errors.js";
import type { ApiClient } from "../http/apiClient.js";
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
} from "./types.js";

/** Maximum events the API accepts in one `/playback/events` call. */
const MAX_PLAYBACK_EVENTS = 500;

/**
 * Content access for the logged-in user (delegated token). Calls AC `/api/v1`
 * directly from the browser; the user's bearer token and `X-AC-Platform` are
 * attached by the {@link ApiClient}.
 */
export class ContentClient {
  constructor(private readonly api: ApiClient) {}

  /** Connectivity + credentials check; also returns the live granted scopes. */
  ping(): Promise<PingResponse> {
    return this.api.request<PingResponse>("/api/v1/ping");
  }

  /** Profile of the studio the integration is bound to. */
  getStudio(): Promise<Studio> {
    return this.api.request<Studio>("/api/v1/studio");
  }

  /** Basic profile of the linked (logged-in) user. */
  getUser(): Promise<UserProfile> {
    return this.api.request<UserProfile>("/api/v1/user/me");
  }

  /** Lists the user's accessible albums (paged). */
  getAlbums(query: AlbumsQuery = {}): Promise<Page<Album>> {
    return this.api.request<Page<Album>>("/api/v1/albums", { query });
  }

  /** Lists the user's accessible artists (paged). */
  getArtists(query: ArtistsQuery = {}): Promise<Page<Artist>> {
    return this.api.request<Page<Artist>>("/api/v1/artists", { query });
  }

  /** Lists an artist's accessible albums (paged). */
  getArtistAlbums(artistId: string, query: ArtistAlbumsQuery = {}): Promise<Page<Album>> {
    return this.api.request<Page<Album>>(`/api/v1/artists/${enc(artistId)}/albums`, { query });
  }

  /** Genres present in the accessible catalogue, each with an album count. */
  getGenres(): Promise<FacetValue[]> {
    return this.api.request<FacetValue[]>("/api/v1/genres");
  }

  /** Formats present in the accessible catalogue, each with an album count. */
  getFormats(): Promise<FacetValue[]> {
    return this.api.request<FacetValue[]>("/api/v1/formats");
  }

  /** Labels present in the accessible catalogue, each with an album count. */
  getLabels(): Promise<FacetValue[]> {
    return this.api.request<FacetValue[]>("/api/v1/labels");
  }

  /** Tracks of an accessible album, in internal order. */
  getAlbumTracks(albumUuid: string, query: AlbumTracksQuery = {}): Promise<Track[]> {
    return this.api.request<Track[]>(`/api/v1/albums/${enc(albumUuid)}/tracks`, { query });
  }

  /** A single track of an accessible album, always including format metadata. */
  getTrack(albumUuid: string, trackId: string): Promise<Track> {
    return this.api.request<Track>(`/api/v1/albums/${enc(albumUuid)}/tracks/${enc(trackId)}`);
  }

  /** Signed streaming URLs for every track of an accessible album. */
  getAlbumPlayback(albumUuid: string): Promise<PlaybackUrl[]> {
    return this.api.request<PlaybackUrl[]>(`/api/v1/albums/${enc(albumUuid)}/playback`);
  }

  /** Signed streaming URL for a single track (drive playback from this). */
  getTrackPlayback(albumUuid: string, trackId: string): Promise<PlaybackUrl> {
    return this.api.request<PlaybackUrl>(`/api/v1/albums/${enc(albumUuid)}/tracks/${enc(trackId)}/playback`);
  }

  /** Full-text search across the user's accessible albums, artists and tracks. */
  search(query: SearchQuery): Promise<SearchResult> {
    return this.api.request<SearchResult>("/api/v1/search", { query });
  }

  /** The user's favourite albums. */
  getFavoriteAlbums(): Promise<Album[]> {
    return this.api.request<Album[]>("/api/v1/favorites/albums");
  }

  /** Adds an album to the user's favourites (idempotent). */
  addFavoriteAlbum(albumUuid: string): Promise<void> {
    return this.api.request<void>(`/api/v1/favorites/albums/${enc(albumUuid)}`, {
      method: "PUT",
    });
  }

  /** Removes an album from the user's favourites (idempotent). */
  removeFavoriteAlbum(albumUuid: string): Promise<void> {
    return this.api.request<void>(`/api/v1/favorites/albums/${enc(albumUuid)}`, {
      method: "DELETE",
    });
  }

  /**
   * Reports completed plays, in batches of up to 500. The batch is atomic —
   * a single invalid event rejects all of them — so give each play a stable
   * `sessionId` and retry the whole batch on failure.
   */
  async reportPlaybackEvents(events: PlaybackEvent[]): Promise<void> {
    if (events.length === 0) return;
    if (events.length > MAX_PLAYBACK_EVENTS) {
      throw new AcSdkError(
        `Too many playback events: ${events.length}. Send at most ${MAX_PLAYBACK_EVENTS} per call.`,
      );
    }
    await this.api.request<void>("/api/v1/playback/events", {
      method: "POST",
      body: events,
    });
  }
}

const enc = encodeURIComponent;
