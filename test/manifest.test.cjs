const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const manifest = JSON.parse(
  readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
);
test("does not claim Redo (Ctrl/Cmd+Shift+Z)", () => {
  for (const binding of manifest.contributes.keybindings) {
    const key = String(binding.key).toLowerCase();
    assert.notEqual(
      key,
      "ctrl+shift+z",
      `${binding.command} must not bind ctrl+shift+z`,
    );
    assert.notEqual(
      key,
      "cmd+shift+z",
      `${binding.command} must not bind cmd+shift+z`,
    );
  }
});
test("Open in Zotero remains in the command palette and editor context menu", () => {
  assert.ok(
    manifest.contributes.commands.some(
      (command) => command.command === "extension.openInZotero",
    ),
  );
  const menus = manifest.contributes.menus["editor/context"];
  assert.ok(
    menus.some((item) => item.command === "extension.openInZotero"),
    "Open in Zotero should appear in the editor context menu",
  );
});
