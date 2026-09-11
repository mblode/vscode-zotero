<div align="center">

# Citation Picker for Zotero

**Pick a reference in Zotero and drop a formatted [Better BibTeX](https://retorque.re/zotero-better-bibtex/) citation at your cursor**

Press one shortcut, search your library in the Zotero picker, and insert citations in Markdown, TeX, Typst, Quarto, or a notebook cell.

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=mblode.zotero">
    <img src="https://vsmarketplacebadges.dev/version-short/mblode.zotero.svg?style=flat&colorA=000000&colorB=000000" />
  </a>
  <a href="https://github.com/mblode/vscode-zotero/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/mblode/vscode-zotero?style=flat&colorA=000000&colorB=000000" />
  </a>
</p>

</div>

## Install

```bash
ext install mblode.zotero
```

Paste that into Quick Open (`cmd+P`), or search "Citation Picker for Zotero" in the Extensions panel.

## Quickstart

Install [Zotero](https://www.zotero.org/download/) and [Better BibTeX](https://retorque.re/zotero-better-bibtex/installation/), then keep Zotero running. Open a Markdown file in VS Code and press `alt+shift+z`. Choose a reference in Zotero; its citation replaces your selection or inserts at the cursor. Multiple cursors receive the same citation.

<img src="https://raw.githubusercontent.com/mblode/vscode-zotero/main/images/screenshot.png" alt="The Zotero picker open over a Markdown file in VS Code" />

## Commands

| Command                  | Shortcut / access                         | Action                                                                                     |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Zotero Citation Picker   | `alt+shift+z`                             | Insert a citation at the cursor.                                                           |
| Open in Zotero           | Command Palette or editor context menu    | Open the citekey under the cursor as a Zotero item.                                        |
| Open PDF from Zotero     | `ctrl+alt+shift+z` or editor context menu | Open the first PDF attached to that item.                                                  |
| Zotero: Check Connection | Command Palette                           | Check the configured endpoint and report Zotero and Better BibTeX versions when available. |

For item and PDF commands, select a single citation key or put the cursor inside it. Keys containing colons, hyphens, periods, and Unicode are supported, including keys inside Pandoc and TeX citations. PDF lookup searches My Library. If the item has no PDF, the item opens instead.

The picker remembers the original document and selections. If that document changes, closes, or its editor becomes unavailable while you choose references, the citation goes to your clipboard with an explanation. With no text editor, the command also copies to the clipboard. Moving to another visible editor does not redirect the insertion.

## Settings

The default behavior is unchanged: insert Pandoc citations using Better BibTeX's Cite as you Write endpoint.

| Setting                          | Default                                                   | Purpose                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `zotero-citation-picker.port`    | `http://127.0.0.1:23119/better-bibtex/cayw?format=pandoc` | Complete CAYW URL, including custom host, port, and query options. PDF lookup uses the same endpoint location.                           |
| `zotero-citation-picker.format`  | `configured`                                              | Preserve the URL's format, or choose `auto`, `pandoc`, `biblatex`, `natbib`, `typst`, `formatted-citation`, or `formatted-bibliography`. |
| `zotero-citation-picker.timeout` | `300`                                                     | Seconds to choose references, from 10 to 1800.                                                                                           |

`auto` chooses `biblatex` for TeX, `typst` for Typst, and `pandoc` for other languages. Both the URL and format support language overrides. For example, keep Pandoc elsewhere and use TeX commands in LaTeX:

```json
{
  "[latex]": {
    "zotero-citation-picker.format": "biblatex"
  }
}
```

To customize the URL:

- **`&minimize=true`:** minimizes Zotero windows after picking.
- **`&brackets=1`:** wraps the citation in Pandoc brackets, `[@key]`.
- **`format=biblatex`:** inserts `\autocite{key}` instead of a Pandoc citekey.
- **`format=natbib&command=citep`:** inserts `\citep{key}`.
- **Port `24119`:** Juris-M and other forks listen there rather than on `23119`.

The [CAYW documentation](https://retorque.re/zotero-better-bibtex/citing/cayw/) lists additional formats, including `eta` templates for custom output. The old `playground` format is no longer supported by current Better BibTeX. Keep the extension's format set to `configured` when the URL selects a custom format. Formatted citations and bibliographies use Zotero's Quick Copy citation style.

## Compatibility and troubleshooting

- Requires desktop VS Code 1.84 or newer and a running Zotero installation with a compatible Better BibTeX version. Version 0.2.0 was tested on VS Code 1.84.2 and 1.136.1, and against Zotero 10.0.1 with Better BibTeX 9.0.63 on macOS. Older Zotero/Better BibTeX pairs were not re-tested for this release.
- In desktop Remote SSH, WSL, and container workspaces, install the extension locally alongside Zotero. It declares the local UI extension host so `127.0.0.1` refers to the desktop. Browser-only VS Code is unsupported. Remote host placement is declared and unit tested; complete SSH/WSL/container sessions are not part of the release test matrix.
- Positron, VSCodium, and other desktop forks may support this VSIX. Their editor implementations are not independently certified here. Notebook cells are supported when the host exposes an editable text editor; otherwise citations go to the clipboard.
- If connection fails, run **Zotero: Check Connection**. Start Zotero, enable Better BibTeX, and check the URL. HTTP error pages are never inserted as citations. Requests connect directly and ignore proxy environment variables.
- Cancel the VS Code progress notification to stop waiting. This does not close Zotero's own dialog; close that dialog before starting another request.
- In an untrusted workspace, the endpoint comes from trusted user settings. Trust the workspace to use a workspace-specific URL.
- A [reported Zotero 7 Flatpak crash on Linux](https://github.com/mblode/vscode-zotero/issues/36) is still unresolved. This extension update does not establish a fix for a crash inside Zotero.

For editors using Open VSX, check the installed version. A release VSIX is also available from [GitHub Releases](https://github.com/mblode/vscode-zotero/releases); use **Extensions: Install from VSIX**.

## Development

Use Node.js 24 LTS. Run `npm ci`, `npm run check`, `npm run lint`, `npm run format:check`, and `npm test`. `npm run package` creates the release VSIX; `npm run test:extension` launches an isolated VS Code 1.84.2 profile. Set `VSCODE_VERSION=stable` to exercise the current editor. CI tests the extracted VSIX on Linux, macOS, and Windows.

The runtime uses native HTTP(S) and has no external dependencies. VS Code API types intentionally match the minimum supported editor; newer API types would raise that compatibility floor. The [compatibility audit](docs/compatibility-audit.md) records issue dispositions, current upstream sources, and verification boundaries.

## License

MIT

---

Crafted by [<img src="https://blode.co/avatar-circle.png" width="20" align="top" />](https://blode.co) [Matthew Blode](https://blode.co)
