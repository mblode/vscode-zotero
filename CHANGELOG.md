# Change Log

All notable changes to the "zotero" extension will be documented in this file.

## 0.2.0

- Preserve citations when the original document changes, closes, or stops accepting edits. Capture selections before opening Zotero and replace multiple selections atomically.
- Replace obsolete request libraries with direct, cancellable HTTP(S), bounded responses, configurable picker timeout, and actionable errors. Proxy environment variables no longer interfere with localhost.
- Use the configured host and port for PDF lookup; support uppercase PDF paths and skip malformed attachments. Open the item when no PDF exists.
- Preserve complete citation keys with punctuation and Unicode, recognize TeX/Pandoc wrappers, and encode item links correctly.
- Run in the local desktop extension host for remote workspaces. Retain notebook and clipboard fallback and scope shortcuts to editors.
- Add language-specific citation formats and **Zotero: Check Connection**. Preserve existing URL options and Pandoc defaults.
- Verify Zotero 10.0.1 / Better BibTeX 9.0.63 and VS Code 1.84.2 / 1.136.1. Add regression and packaged editor tests, cross-platform CI, and dependency maintenance.
- Update retained development tools, remove all runtime dependencies and obsolete compiled files, and bundle the extension into a small VSIX. Keep VS Code API types at the supported minimum.

## 0.1.11

- Migrated to TypeScript

## 0.1.9

- Added option to customise the port/URL

## 0.1.0

- Initial release
