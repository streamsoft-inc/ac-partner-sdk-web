# Artist Connection Partner SDK — JavaScript / TypeScript

Official TypeScript client for the [Artist Connection Partner API](https://docs.artistconnection.net/integration/).
For browser and Node.

> **Not implemented yet.** This repository is a placeholder so the package name and issue tracker
> exist. There is nothing to install here today.
>
> The [Swift SDK](https://github.com/streamsoft-inc/ac-partner-sdk-ios) is complete and is the
> reference implementation this one will follow — same type names, same error taxonomy, same
> pagination and reporting semantics, translated to TypeScript idiom.

## Nothing here blocks you

The API is plain HTTP and JSON, and there are **four working browser and Node samples** you can
read or clone today, plus a live demo:

- [Try it in the browser](https://docs.artistconnection.net/integration/try/) — the hosted
  public-client demo, PKCE and all
- [Integration Guide](https://docs.artistconnection.net/integration/partner-integration-guide.html) —
  the whole flow in `curl`
- [API Reference](https://docs.artistconnection.net/integration/partner-api-reference.html)

## Planned scope

Parity with the Swift SDK, with one difference that matters: this package targets **two runtimes**,
and they authenticate differently.

- **Browser** — a public client. Authorization code + PKCE, no secret, `X-AC-Platform: web`
  required on every content call, and calls allowed only from the origins registered for your
  integration (CORS).
- **Node** — a confidential client. `client_credentials` with a secret that stays on your server.

Both share the same typed endpoint surface: every `/api/v1` endpoint, an async-iterator paging
helper, a playback reporter with pause-aware listening time and idempotent session ids, and an error
taxonomy that separates an expired playback URL from an authentication failure.

Planned package: `@artistconnection/partner-sdk`, ESM and CJS, types included, no runtime
dependencies.

## Interested?

Open an issue, or email support@artistconnection.net — knowing someone is waiting on it moves it up
the list.

## License

MIT — see [LICENSE](LICENSE).
