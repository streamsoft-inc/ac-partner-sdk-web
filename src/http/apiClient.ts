import type { OAuthClient } from "../auth/oauthClient.js";
import { AcApiError, AcSdkError } from "../errors.js";

export interface ApiClientOptions {
  apiBaseUrl: string;
  oauth: OAuthClient;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  /** Value for the mandatory `X-AC-Platform` header on content requests. */
  platform: string;
}

export interface ApiRequestOptions {
  method?: string;
  query?: object;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Authenticated client for AC `/api/v1` endpoints, called directly from the
 * browser. Attaches the user's bearer token and `X-AC-Platform`, and refreshes
 * once on a 401.
 */
export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    try {
      return await this.send<T>(path, options, false);
    } catch (error) {
      if (error instanceof AcApiError && error.status === 401) {
        await this.options.oauth.refreshTokens();
        return this.send<T>(path, options, true);
      }
      throw error;
    }
  }

  private async send<T>(path: string, options: ApiRequestOptions, isRetry: boolean): Promise<T> {
    const token = await this.options.oauth.getAccessToken();
    const url = this.buildUrl(path, options.query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const signal = options.signal ? anySignal([options.signal, controller.signal]) : controller.signal;

    let response: Response;
    try {
      response = await this.options.fetchImpl(url, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-AC-Platform": this.options.platform,
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new AcSdkError(`Request to ${path} timed out after ${this.options.timeoutMs}ms.`, { cause });
      }
      throw new AcSdkError(`Network error while requesting ${path}.`, { cause });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 && !isRetry) {
      throw new AcApiError("Unauthorized.", { status: 401 });
    }

    if (!response.ok) {
      const body = await safeParse(response);
      throw new AcApiError(`Request to ${path} failed with status ${response.status}.`, { status: response.status, body });
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await safeParse(response)) as T;
  }

  private buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
    const base = this.options.apiBaseUrl.replace(/\/+$/, "");
    const rel = path.replace(/^\/+/, "");
    const url = new URL(`${base}/${rel}`);
    if (query) {
      for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
      }
    }
    return url.toString();
  }
}

async function safeParse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}
