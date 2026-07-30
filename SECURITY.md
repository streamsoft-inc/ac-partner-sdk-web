# Security

## Reporting a vulnerability

Email **support@artistconnection.net** with "Security" in the subject. Please do not open a public
issue for anything exploitable.

Include what you can: affected version, reproduction steps, and impact. We will acknowledge within
three business days.

## Scope

This repository has no released code yet. Vulnerabilities in the Artist Connection Partner API
itself, or in the [Swift SDK](https://github.com/streamsoft-inc/ac-partner-sdk-ios), are in scope
for the same address.

## Guidance for integrators

Until this SDK exists, you are writing the OAuth handling yourself. The parts that carry security
weight:

- **No client secret in a shipped app or a browser bundle.** Use a public client with PKCE. A secret
  in a binary or a JS bundle is extractable by anyone who downloads it.
- **Store refresh tokens in platform-protected storage** — the Android keystore /
  `EncryptedSharedPreferences`, or the browser's session storage at the shortest useful lifetime.
  A refresh token is a 30-day credential that acts as the user.
- **Verify the redirect's `state`** against the value you sent, before redeeming the authorization
  code.
- **Use a reverse-DNS private-use redirect scheme** on native apps. Any app can register a short
  scheme like `myapp://` and intercept your code.
