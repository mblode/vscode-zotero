<a href="https://marketplace.visualstudio.com/items?itemName=mblode.zotero">
  <img src="images/icon.png" alt="" width=100 height=100>
</a>

# VS Code Citation Picker for Zotero

This extension integrates Zotero (with Better BibTeX) into VS Code, supporting citations across multiple languages and formats. \
The standard configuration (`?format=pandoc`) works for markdown.

Make sure you have Better BibTeX installed in Zotero to use it.

## Features

If you don't feel like typing citations out (and let's be honest, you don't), executing 'Zotero Citation Picker' will call up a graphical picker which will insert these for you, formatted and all.

- Activate via Command Palette (command + shift + P): Type "Zotero Citation Picker" and press enter.
- Activate via keyboard shortcut: Use alt+shift+z

<img src="images/screenshot.png" style="width: 80%;" alt="Screenshot">

## Requirements

**IMPORTANT:** Zotero, with Better BibTeX installed, must be running while you use these.

## Configuration

The formats which are supported by this plugin depend on the [CAYW (Cite as you Write)](https://retorque.re/zotero-better-bibtex/citing/cayw/index.html) implementation by zotero-better-bibtex.

An excerpt of the formats that are supported are as follows:
- `natbib` generates [natbib](https://ctan.org/pkg/natbib) citations for LaTeX using the cite command by default (configurable, see documentation above)
  - `latex` and `cite` are aliases for `natbib` and also use the `cite` command
- `biblatex` uses the autocite command by default (configurable, see documentation above)
- `pandoc`
- `mmd` for MultiMarkdown
- `asciidoctor-bibtex`
- `jupyter`
- `typst`

This is not an exhaustive list. For more formats and further configuration options see the [better-bibtex documentation](https://retorque.re/zotero-better-bibtex/citing/cayw/index.html#diy).

To change the used format just replace `?format=pandoc` in the configuration with `?format=<chosen-format>`.
