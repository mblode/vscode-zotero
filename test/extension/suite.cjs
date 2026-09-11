const vscode = require("vscode");
const assert = require("node:assert/strict");
const http = require("node:http");
exports.run = async () => {
  const extension = vscode.extensions.getExtension("mblode.zotero");
  assert.ok(extension);
  await extension.activate();
  assert.deepEqual(extension.packageJSON.extensionKind, ["ui"]);
  assert.equal(extension.packageJSON.dependencies, undefined);
  const commands = await vscode.commands.getCommands(true);
  for (const id of [
    "extension.zoteroCitationPicker",
    "extension.openInZotero",
    "extension.openPDFZotero",
    "extension.zoteroCheckConnection",
  ])
    assert.ok(commands.includes(id), id);
  for (const binding of extension.packageJSON.contributes.keybindings) {
    const key = String(binding.key).toLowerCase();
    assert.notEqual(key, "ctrl+shift+z", binding.command);
    assert.notEqual(key, "cmd+shift+z", binding.command);
  }
  const contextMenus =
    extension.packageJSON.contributes.menus["editor/context"];
  assert.ok(
    contextMenus.some((item) => item.command === "extension.openInZotero"),
  );
  let handler = (_req, res) => res.end("@Smith:2026-a");
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/better-bibtex/cayw?format=pandoc`;
  const config = vscode.workspace.getConfiguration("zotero-citation-picker");
  const pick = () =>
    vscode.commands.executeCommand("extension.zoteroCitationPicker");
  async function open(content) {
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "markdown",
    });
    return vscode.window.showTextDocument(doc, { preview: false });
  }
  async function close() {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  }
  try {
    await config.update("port", url, vscode.ConfigurationTarget.Global);
    let editor = await open("replace");
    editor.selection = new vscode.Selection(0, 0, 0, 7);
    await pick();
    assert.equal(editor.document.getText(), "@Smith:2026-a");
    editor = await open("aa bb");
    editor.selections = [
      new vscode.Selection(0, 0, 0, 2),
      new vscode.Selection(0, 3, 0, 5),
    ];
    await pick();
    assert.equal(editor.document.getText(), "@Smith:2026-a @Smith:2026-a");
    let accept;
    let entered = new Promise((resolve) => (accept = resolve));
    handler = (_req, res) => accept(res);
    const original = await open("original");
    original.selection = new vscode.Selection(0, 0, 0, 8);
    let pending = pick();
    let response = await entered;
    const other = await open("other");
    response.end("@Original");
    await pending;
    assert.equal(original.document.getText(), "original");
    assert.equal(other.document.getText(), "other");
    assert.equal(await vscode.env.clipboard.readText(), "@Original");
    const visibleOriginal = await open("visible");
    visibleOriginal.selection = new vscode.Selection(0, 0, 0, 7);
    entered = new Promise((resolve) => (accept = resolve));
    pending = pick();
    response = await entered;
    const beside = await vscode.workspace.openTextDocument({
      content: "beside",
      language: "markdown",
    });
    await vscode.window.showTextDocument(beside, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });
    response.end("@Visible");
    await pending;
    assert.equal(visibleOriginal.document.getText(), "@Visible");
    assert.equal(beside.getText(), "beside");
    editor = await open("unchanged");
    editor.selection = new vscode.Selection(0, 0, 0, 9);
    entered = new Promise((resolve) => (accept = resolve));
    pending = pick();
    response = await entered;
    await editor.edit((edit) =>
      edit.insert(new vscode.Position(0, 9), " edited"),
    );
    response.end("@Recovered");
    await pending;
    assert.equal(editor.document.getText(), "unchanged edited");
    assert.equal(await vscode.env.clipboard.readText(), "@Recovered");
    // Close clean documents without triggering unsaved-file prompts.
    await vscode.commands.executeCommand(
      "workbench.action.revertAndCloseActiveEditor",
    );
    handler = (_req, res) => res.end("");
    editor = await open("cancelled");
    await pick();
    assert.equal(editor.document.getText(), "cancelled");
    handler = (_req, res) => {
      res.writeHead(500);
      res.end("not a citation");
    };
    await pick();
    assert.equal(editor.document.getText(), "cancelled");
    await config.update("format", "auto", vscode.ConfigurationTarget.Global);
    const tex = await vscode.workspace.openTextDocument({
      language: "latex",
      content: "",
    });
    await vscode.window.showTextDocument(tex);
    handler = (req, res) => {
      assert.equal(
        new URL(req.url, url).searchParams.get("format"),
        "biblatex",
      );
      res.end("\\autocite{Smith}");
    };
    await pick();
    assert.equal(tex.getText(), "\\autocite{Smith}");
    handler = (req, res) =>
      res.end(
        req.method === "POST"
          ? '{"jsonrpc":"2.0","id":1,"result":{"zotero":"10.0.1","betterbibtex":"9.0.63"}}'
          : "ready",
      );
    await vscode.commands.executeCommand("extension.zoteroCheckConnection");
    console.log(
      `Zotero packaged extension integration passed on VS Code ${vscode.version}: activation, manifest, replacement, multicursor, hidden editor recovery, visible original editor, stale edit recovery, cancellation, server error, language format, diagnostics.`,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await config.update("port", undefined, vscode.ConfigurationTarget.Global);
    await config.update("format", undefined, vscode.ConfigurationTarget.Global);
    // Test host exits with its disposable profile; avoid prompts for untitled test buffers.
    void close;
  }
};
