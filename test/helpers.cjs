const { buildSync } = require("esbuild");
const Module = require("node:module");
const path = require("node:path");
const http = require("node:http");
exports.load = (file, vscode) => {
  const filename = path.resolve(file);
  const source = buildSync({
    entryPoints: [filename],
    bundle: true,
    external: ["vscode"],
    platform: "node",
    format: "cjs",
    write: false,
  }).outputFiles[0].text;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  const original = mod.require.bind(mod);
  mod.require = (id) => (id === "vscode" ? vscode : original(id));
  mod._compile(source, filename);
  return mod.exports;
};
exports.server = async (handler) => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: new URL(
      `http://127.0.0.1:${server.address().port}/better-bibtex/cayw?format=pandoc`,
    ),
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
};
exports.mock = (url) => {
  const state = {
    commands: {},
    messages: [],
    clipboard: [],
    opened: [],
    cancellation: undefined,
    config: { port: String(url) },
    disposables: [],
  };
  const show = (message) => {
    state.messages.push(message);
    return Promise.resolve(undefined);
  };
  const vscode = {
    window: {
      visibleTextEditors: [],
      showInformationMessage: show,
      showErrorMessage: show,
      showWarningMessage: show,
      withProgress: async (_options, run) =>
        run(
          {},
          {
            isCancellationRequested: false,
            onCancellationRequested: (fn) => {
              state.cancellation = fn;
              return { dispose() {} };
            },
          },
        ),
    },
    workspace: {
      getConfiguration: (_section, document) => {
        state.scope = document;
        return { get: (key, fallback) => state.config[key] ?? fallback };
      },
    },
    env: {
      clipboard: {
        writeText: async (value) => {
          state.clipboard.push(value);
        },
      },
      openExternal: async (uri) => {
        state.opened.push(uri.toString());
        return true;
      },
    },
    commands: {
      registerCommand: (name, fn) => {
        state.commands[name] = fn;
        return { dispose() {} };
      },
    },
    ProgressLocation: { Notification: 15 },
    Uri: { parse: (value) => ({ toString: () => value }) },
  };
  return { state, vscode, context: { subscriptions: state.disposables } };
};
exports.editor = (
  text = "replace",
  keys = [
    { start: 0, end: 7, isEmpty: false, active: { line: 0, character: 0 } },
  ],
) => {
  const doc = {
    version: 1,
    isClosed: false,
    languageId: "markdown",
    uri: { toString: () => "file:///fixture.md" },
    getText: (range) => (range ? text.slice(range.start, range.end) : text),
    lineAt: () => ({ text }),
  };
  return {
    document: doc,
    selections: keys,
    selection: keys[0],
    edit: async (build) => {
      const edits = [];
      build({ replace: (range, value) => edits.push({ range, value }) });
      for (const { range, value } of edits.sort(
        (a, b) => b.range.start - a.range.start,
      ))
        text = text.slice(0, range.start) + value + text.slice(range.end);
      doc.version++;
      return true;
    },
  };
};
