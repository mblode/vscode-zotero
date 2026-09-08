# Zotero compatibility release

This is the authoritative plan for 0.2.0 (2026-09-08).

## Outcome

Keep the existing Marketplace ID and all three command IDs. Fix connection failures behind proxies, remote-host localhost mistakes, stale-editor insertion, incomplete citation keys, and PDF lookup on custom endpoints. Preserve notebook and clipboard fallback. Update retained build dependencies to current stable releases and remove obsolete runtime dependencies.

## Approach and decisions

- Replace request/request-promise with bounded, cancellable native HTTP(S). Explicit User-Agent, no environment proxy or redirects, classified errors, 1 MiB response limit. A user choosing references can take minutes; picker timeout is configurable, short API diagnostics are separate.
- Capture the document, version, and selections before opening the picker. Replace each selection once. If the document closes, changes, or rejects the edit, preserve the citation on the clipboard and explain why. Suppress duplicate picker requests.
- Derive JSON-RPC from the configured CAYW URL, preserving its origin and path prefix. Validate RPC envelopes and attachment shapes. Only open Zotero protocol URLs returned for PDFs; surface failures instead of logging them silently.
- Run locally as a UI extension for desktop SSH/WSL/container workspaces. Preserve the VS Code 1.84 minimum and test 1.84.2 plus current stable. Pin VS Code API types to 1.84.2 so newer APIs cannot accidentally raise the minimum; vsce also enforces this relationship. Other retained tools use current stable releases. Use native runtime APIs available in Node 18.
- Allow language-specific picker settings, add documented format overrides and a connection diagnostic. Keep existing URL query options by default. Correct obsolete playground advice.
- Bundle with esbuild, use strict TypeScript and native Node tests, package a small VSIX with no runtime dependencies. Add CI and dependency maintenance.

## Verification

- HTTP regression server: proxy environment, status/invalid data/timeout/abort/oversized responses; CAYW formatting and current BBT JSON-RPC fixtures.
- Command regressions: original document, changed/closed/read-only documents, notebook fallback, multiple selections, cancellation, duplicate invocations, punctuation and Unicode keys, custom endpoint and missing/uppercase PDFs.
- Extract and activate the release VSIX in minimum and stable VS Code. Exercise actual editor edits, clipboard fallback, settings, diagnostics and command registration.
- Check the current Zotero 10.0.1 / Better BibTeX 9.0.63 APIs in an isolated disposable profile if the official application can run here; record the exact verification limit. Never use a personal library for fixtures.
- npm audit, lint, typecheck, package inspection, GitHub CI, then Marketplace publication and public package/version readback.

## Boundaries and recovery

The Linux Flatpak Zotero 7 crash (#36) needs a Zotero-side stack trace/reproducer; do not claim that upgrading this extension fixes it. Native picker, inline citation rendering and bibliography generation are separate features. Open VSX publication requires existing publisher access; provide the VSIX if unavailable. Browser-only VS Code cannot reach the local desktop integration. Release rollback is an incremented patch with the previous source; keep the previous Marketplace package available.
