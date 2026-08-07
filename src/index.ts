export { AcPartnerClient } from "./client.js";
export type { AcPartnerClientConfig } from "./client.js";

export type { ConnectOptions } from "./auth/oauthClient.js";
export { LocalTokenStorage, MemoryTokenStorage } from "./auth/tokenStore.js";
export type { StoredTokens, TokenStorage } from "./auth/tokenStore.js";

export type {
  Album,
  AlbumsQuery,
  AlbumSort,
  AlbumTracksQuery,
  Artist,
  ArtistAlbumsQuery,
  ArtistsQuery,
  ArtistSort,
  Artwork,
  ArtworkImage,
  ArtworkRendition,
  FacetValue,
  Page,
  PingResponse,
  PlaybackEvent,
  PlaybackUrl,
  SearchContext,
  SearchQuery,
  SearchResult,
  SearchTrack,
  Studio,
  Track,
  TrackMetadata,
  UserProfile,
} from "./content/types.js";

export { AcApiError, AcAuthError, AcSdkError } from "./errors.js";
