const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { runTests } = require("@vscode/test-electron");
const workspace = fs.mkdtempSync(
  path.join(os.tmpdir(), "zotero-extension-test-"),
);
runTests({
  ...(process.env.VSCODE_EXECUTABLE_PATH
    ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH }
    : { version: process.env.VSCODE_VERSION || "1.84.2" }),
  extensionDevelopmentPath:
    process.env.ZOTERO_EXTENSION_PATH || path.resolve(__dirname, "../.."),
  extensionTestsPath: path.resolve(__dirname, "suite.cjs"),
  launchArgs: [
    workspace,
    `--user-data-dir=${path.join(workspace, ".profile")}`,
    `--extensions-dir=${path.join(workspace, ".extensions")}`,
    "--disable-extensions",
    "--disable-workspace-trust",
    "--skip-welcome",
    "--skip-release-notes",
    "--no-sandbox",
  ],
}).then(
  () =>
    fs.rmSync(workspace, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    }),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
