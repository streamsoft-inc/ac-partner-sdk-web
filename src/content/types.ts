/** A downscaled or original image with its real pixel dimensions. */
export interface ArtworkImage {
  url: string;
  width: number | null;
  height: number | null;
  format: string | null;
  byteSize?: number | null;
}

/** A generated rendition; `targetWidth` is the size bucket, not the real width. */
export interface ArtworkRendition extends ArtworkImage {
  targetWidth: number;
}

/** Original image plus every generated size. Present only with `includeArtwork`. */
export interface Artwork {
  /** "UPLOADED" | "STUDIO_DEFAULT" | "PLACEHOLDER" (treat unknown as UPLOADED). */
  source: string;
  original: ArtworkImage | null;
  renditions: ArtworkRendition[];
}

/** An artist as returned by the API. */
export interface Artist {
  id: string;
  name: string;
  description?: string | null;
  imageUrl: string | null;
  /** Populated only in the artist listing; null when nested. */
  albumCount: number | null;
  artwork?: Artwork | null;
}

/** An album as returned by the API. */
export interface Album {
  uuid: string;
  title: string;
  /** Primary artist name; prefer `artistDetails`. */
  artist: string | null;
  artistDetails: Artist | null;
  coverUrl: string | null;
  trackCount: number | null;
  durationSeconds: number | null;
  description: string | null;
  /** Partial date: `YYYY` or `YYYY-MM-DD`; often absent. */
  releaseDate: string | null;
  artwork?: Artwork | null;
}

/** A page of results from a paged listing. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export type AlbumSort = "NAME_ASC" | "NAME_DESC" | "ARTIST_ASC" | "ARTIST_DESC" | "DURATION_ASC" | "DURATION_DESC" | "CREATED_DESC" | "CREATED_ASC";

export interface AlbumsQuery {
  /** Page size. Default 50, capped at 200. */
  limit?: number;
  /** 0-based offset. */
  offset?: number;
  sort?: AlbumSort;
  /** Case-insensitive substring filter (browse, not full-text search). */
  nameContains?: string;
  /** Facet filters (OR within a facet, AND across facets). */
  genres?: string[];
  formats?: string[];
  labels?: string[];
  /** Include the `artwork` object on each album. */
  includeArtwork?: boolean;
}

/**
 * Query for a single artist's albums. Same as {@link AlbumsQuery} minus the
 * facet filters — `/artists/{id}/albums` does not accept them.
 */
export type ArtistAlbumsQuery = Omit<AlbumsQuery, "genres" | "formats" | "labels">;

export type SearchContext = "ALBUMS" | "ARTISTS" | "FILES" | "ALL";

export interface SearchQuery {
  /** Text matched against album, artist and track names. */
  query: string;
  /** Categories to search. Default `ALL`. */
  context?: SearchContext;
  /** Max results per category. Default 20, max 50. */
  limit?: number;
  includeArtwork?: boolean;
}

/** A track as returned in search results (carries its album's uuid). */
export interface SearchTrack {
  albumUuid: string;
  id: string;
  title: string;
  type: string;
  durationSeconds: number | null;
}

export interface SearchResult {
  albums: Album[];
  artists: Artist[];
  tracks: SearchTrack[];
}

export type ArtistSort = "NAME_ASC" | "NAME_DESC" | "ALBUM_COUNT_DESC" | "ALBUM_COUNT_ASC";

export interface ArtistsQuery {
  limit?: number;
  offset?: number;
  sort?: ArtistSort;
  nameContains?: string;
  includeArtwork?: boolean;
}

/** A facet value (genre/format/label) with the number of albums carrying it. */
export interface FacetValue {
  name: string;
  albumCount: number;
}

/** Technical format metadata for a track. Every field is best-effort. */
export interface TrackMetadata {
  codec: string | null;
  mimeType: string | null;
  sampleRateHz: number | null;
  bitDepth: number | null;
  channels: number | null;
  bitrateKbps: number | null;
  durationSeconds: number | null;
  lossless: boolean | null;
}

/** A track (song or video) on an album. */
export interface Track {
  id: string;
  title: string;
  /** e.g. "AUDIO", "VIDEO", "MULTI_SOURCE_AUDIO". */
  type: string;
  durationSeconds: number | null;
  /** 1-based position in the album's internal order. */
  position: number | null;
  /** Present only when requested with `includeMetadata`, or on single-track fetches. */
  metadata?: TrackMetadata | null;
}

export interface AlbumTracksQuery {
  /** Embed each track's format metadata inline. */
  includeMetadata?: boolean;
}

/** A short-lived signed streaming URL for a track. */
export interface PlaybackUrl {
  trackId: string;
  type: string;
  /** Null when the track has no playable source stored. */
  url: string | null;
  /** ISO-8601 instant at which `url` stops working. */
  expiresAt: string | null;
  expiresInSeconds: number | null;
}

/**
 * A completed play, reported after playback finishes. Timestamps are Unix
 * milliseconds (UTC), durations are seconds.
 */
export interface PlaybackEvent {
  albumUuid: string;
  trackId: string;
  /** When playback started. */
  startedAt: number;
  /** When playback ended; must be >= `startedAt`. */
  endedAt: number;
  /** Seconds actually listened, excluding pauses. Clamped to the reported span. */
  listeningTime: number;
  /** Playhead position at the end of the play. */
  position?: number;
  /** Stable per-play id so the server can de-duplicate retries. */
  sessionId?: string;
}

/** Connectivity/credentials check response. */
export interface PingResponse {
  clientId: string;
  clientName: string | null;
  scopes: string[];
  serverTime: string;
}

/** Profile of the studio the integration is bound to. */
export interface Studio {
  uuid: string;
  name: string;
  city: string | null;
  country: string | null;
}

/** Profile of the linked (logged-in) user. */
export interface UserProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
  consentedScopes: string[];
}
