<div align="center">

# Citation Picker for Zotero

**Pick a reference in Zotero and drop a formatted [Better BibTeX](https://retorque.re/zotero-better-bibtex/) citation at your cursor**

Press one shortcut in a Markdown file, search your library in the Zotero picker, and the citekey is inserted for you.

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

Start Zotero, open a Markdown file in VS Code, and press `alt+shift+z`. The Better BibTeX picker opens over the editor; choose a reference and the citation replaces your selection.

<img src="https://raw.githubusercontent.com/mblode/vscode-zotero/main/images/screenshot.png" alt="The Zotero picker open over a Markdown file in VS Code" />

## Commands

| Command | Shortcut | Action |
|---------|----------|--------|
| Zotero Citation Picker | `alt+shift+z` | Insert a citation at the cursor. |
| Open in Zotero | `ctrl+shift+z` | Open the citekey under the cursor as a Zotero item. |
| Open PDF from Zotero | `ctrl+alt+shift+z` | Open the first PDF attached to that item. |

With no editor to insert into, the citation goes to your clipboard instead of being lost.

## Settings

The picker calls Better BibTeX's Cite as you Write endpoint. `zotero-citation-picker.port` holds the URL it requests, and defaults to `http://127.0.0.1:23119/better-bibtex/cayw?format=pandoc`. Edit that value to change what gets inserted:

- **`&minimize=true`:** leaves Zotero in the background instead of taking focus.
- **`&brackets=1`:** wraps the citation in Pandoc brackets, `[@key]`.
- **`format=biblatex`:** inserts `\autocite{key}` instead of a Pandoc citekey.
- **`format=playground`:** inserts the bare citekey, with no `@` and no brackets.
- **Port `24119`:** Juris-M and other forks listen there rather than on `23119`.

The [CAYW documentation](https://retorque.re/zotero-better-bibtex/citing/cayw/) lists every format and parameter.

## Requirements

- Zotero has to be running, with the [Better BibTeX](https://retorque.re/zotero-better-bibtex/) plugin installed. The picker belongs to Better BibTeX, so nothing works without it.
- VS Code 1.84 or newer.

## License

MIT

---

Crafted by [<img src="https://blode.co/avatar-circle.png" width="20" align="top" />](https://blode.co) [Matthew Blode](https://blode.co)
