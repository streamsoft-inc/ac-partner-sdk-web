/**
 * Error thrown for any failure originating from the AC Partner SDK.
 */
export class AcSdkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AcSdkError";
    if (options?.cause !== undefined) {
      // Preserve the original error for debugging.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * Thrown when authentication fails (bad credentials, proxy error, etc.).
 */
export class AcAuthError extends AcSdkError {
  readonly status?: number;
  readonly body?: unknown;

  constructor(
    message: string,
    options?: { status?: number; body?: unknown; cause?: unknown },
  ) {
    super(message, options);
    this.name = "AcAuthError";
    this.status = options?.status;
    this.body = options?.body;
  }
}

/**
 * Thrown when an API request returns a non-successful HTTP status.
 */
export class AcApiError extends AcSdkError {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, options: { status: number; body?: unknown; cause?: unknown }) {
    super(message, options);
    this.name = "AcApiError";
    this.status = options.status;
    this.body = options.body;
  }
}
