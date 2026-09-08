const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load, server, mock, editor } = require("./helpers.cjs");
async function setup(handler) {
  const s = await server(handler || ((_q, r) => r.end("@key")));
  const m = mock(s.url);
  const extension = load("src/extension.ts", m.vscode);
  extension.activate(m.context);
  return {
    ...m,
    s,
    extension,
    close: async () => {
      m.context.subscriptions.forEach((d) => d.dispose());
      await s.close();
    },
  };
}
const pick = (m) => m.state.commands["extension.zoteroCitationPicker"]();
async function delayed(change) {
  let resolve;
  const incoming = new Promise((r) => (resolve = r));
  const m = await setup((_q, res) => resolve(res));
  const original = editor();
  m.vscode.window.activeTextEditor = original;
  try {
    const operation = pick(m);
    const response = await incoming;
    await change(m, original);
    response.end("@key");
    await operation;
    return { m, original };
  } finally {
    await m.close();
  }
}
test("all commands register and command returns insertion promise", async () => {
  const m = await setup();
  const e = editor();
  m.vscode.window.activeTextEditor = e;
  try {
    assert.equal(Object.keys(m.state.commands).length, 4);
    await pick(m);
    assert.equal(e.document.getText(), "@key");
    assert.equal(m.state.scope, e.document);
  } finally {
    await m.close();
  }
});
test("delayed citation stays with original editor", async () => {
  const { m, original } = await delayed((m) => {
    m.vscode.window.activeTextEditor = editor("other");
  });
  assert.equal(original.document.getText(), "@key");
  assert.equal(m.vscode.window.activeTextEditor.document.getText(), "other");
});
test("moving cursor does not move original insertion", async () => {
  const { original } = await delayed((_m, e) => {
    e.selections = [{ start: 7, end: 7 }];
  });
  assert.equal(original.document.getText(), "@key");
});
for (const mode of ["changed", "closed", "rejected", "throws"])
  test(`${mode} editor preserves citation on clipboard`, async () => {
    const { m } = await delayed((_m, e) => {
      if (mode === "changed") e.document.version++;
      if (mode === "closed") e.document.isClosed = true;
      if (mode === "rejected") e.edit = async () => false;
      if (mode === "throws")
        e.edit = async () => {
          throw Error("closed");
        };
    });
    assert.deepEqual(m.state.clipboard, ["@key"]);
    assert.match(m.state.messages[0], /clipboard/);
  });
test("multiple selections are replaced once", async () => {
  const m = await setup();
  const e = editor("aa bb", [
    { start: 0, end: 2 },
    { start: 3, end: 5 },
  ]);
  m.vscode.window.activeTextEditor = e;
  try {
    await pick(m);
    assert.equal(e.document.getText(), "@key @key");
  } finally {
    await m.close();
  }
});
test("no editor clipboard fallback", async () => {
  const m = await setup();
  try {
    await pick(m);
    assert.deepEqual(m.state.clipboard, ["@key"]);
  } finally {
    await m.close();
  }
});
test("empty picker response is a no-op", async () => {
  const m = await setup((_q, r) => r.end(""));
  const e = editor();
  m.vscode.window.activeTextEditor = e;
  try {
    await pick(m);
    assert.equal(e.document.getText(), "replace");
    assert.equal(m.state.clipboard.length, 0);
  } finally {
    await m.close();
  }
});
test("notebook fallback resolves visible cell; empty notebook is safe", async () => {
  const m = await setup();
  const e = editor();
  m.vscode.window.visibleTextEditors = [e];
  m.vscode.window.activeNotebookEditor = {
    selection: { start: 0 },
    notebook: { cellCount: 1, cellAt: () => ({ document: e.document }) },
  };
  try {
    await pick(m);
    assert.equal(e.document.getText(), "@key");
    m.vscode.window.activeNotebookEditor.notebook.cellCount = 0;
    assert.equal(m.extension.resolveActiveEditor(), undefined);
  } finally {
    await m.close();
  }
});
test("duplicate picker invokes HTTP once", async () => {
  let resolve;
  const entered = new Promise((r) => (resolve = r));
  let requests = 0;
  const m = await setup((_q, res) => {
    requests++;
    resolve(res);
  });
  try {
    const pending = pick(m);
    const response = await entered;
    await pick(m);
    response.end("");
    await pending;
    assert.equal(requests, 1);
    assert.match(m.state.messages[0], /already open/);
  } finally {
    await m.close();
  }
});
test("progress cancellation stops insertion and allows another picker", async () => {
  let resolve;
  const entered = new Promise((r) => (resolve = r));
  const m = await setup((_q, res) => resolve(res));
  try {
    const pending = pick(m);
    await entered;
    m.state.cancellation();
    await pending;
    assert.deepEqual(m.state.clipboard, []);
    assert.deepEqual(m.state.messages, []);
  } finally {
    await m.close();
  }
});
test("open item encodes complete selected key", async () => {
  const m = await setup();
  m.vscode.window.activeTextEditor = editor("[@Müller:2026#A]", [
    { start: 0, end: 16, isEmpty: false },
  ]);
  try {
    await m.state.commands["extension.openInZotero"]();
    assert.equal(
      m.state.opened[0],
      "zotero://select/items/bbt:M%C3%BCller%3A2026%23A",
    );
  } finally {
    await m.close();
  }
});
test("PDF command uses configured API, skips link and opens PDF", async () => {
  const m = await setup((req, res) => {
    assert.equal(req.url, "/better-bibtex/json-rpc");
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: [
          { path: false },
          { path: "/x.PDF", open: "zotero://open-pdf/library/items/ABCDEFGH" },
        ],
      }),
    );
  });
  m.vscode.window.activeTextEditor = editor("key", [
    { start: 0, end: 3, isEmpty: false },
  ]);
  try {
    await m.state.commands["extension.openPDFZotero"]();
    assert.equal(m.state.opened[0], "zotero://open-pdf/library/items/ABCDEFGH");
  } finally {
    await m.close();
  }
});
test("missing PDF opens item and explains fallback", async () => {
  const m = await setup((_q, r) =>
    r.end('{"jsonrpc":"2.0","id":1,"result":[]}'),
  );
  m.vscode.window.activeTextEditor = editor("key", [
    { start: 0, end: 3, isEmpty: false },
  ]);
  try {
    await m.state.commands["extension.openPDFZotero"]();
    assert.match(m.state.messages[0], /no PDF/);
    assert.equal(m.state.opened[0], "zotero://select/items/bbt:key");
  } finally {
    await m.close();
  }
});
test("server failure is visible and does not mutate editor", async () => {
  const m = await setup((_q, r) => {
    r.writeHead(500);
    r.end("error");
  });
  const e = editor();
  m.vscode.window.activeTextEditor = e;
  try {
    await pick(m);
    assert.match(m.state.messages[0], /HTTP 500/);
    assert.equal(e.document.getText(), "replace");
  } finally {
    await m.close();
  }
});
test("diagnostic reports actual Zotero and Better BibTeX versions", async () => {
  const m = await setup((req, res) =>
    res.end(
      req.method === "POST"
        ? '{"jsonrpc":"2.0","id":1,"result":{"zotero":"10.0.1","betterbibtex":"9.0.63"}}'
        : "ready",
    ),
  );
  try {
    await m.state.commands["extension.zoteroCheckConnection"]();
    assert.match(m.state.messages[0], /Zotero 10.0.1; Better BibTeX 9.0.63/);
  } finally {
    await m.close();
  }
});
test("old Better BibTeX without api.ready still reports CAYW readiness", async () => {
  const m = await setup((req, res) =>
    res.end(
      req.method === "POST"
        ? '{"jsonrpc":"2.0","id":1,"error":{"message":"method not found"}}'
        : "ready",
    ),
  );
  try {
    await m.state.commands["extension.zoteroCheckConnection"]();
    assert.match(m.state.messages[0], /picker is ready/);
  } finally {
    await m.close();
  }
});
test("deactivation cancels version lookup without a late ready message", async () => {
  let accept;
  const entered = new Promise((resolve) => (accept = resolve));
  const m = await setup((req, res) => {
    if (req.method === "POST") accept();
    else res.end("ready");
  });
  try {
    const pending = m.state.commands["extension.zoteroCheckConnection"]();
    await entered;
    for (const disposable of m.state.disposables) disposable.dispose();
    await pending;
    assert.deepEqual(m.state.messages, []);
  } finally {
    await m.close();
  }
});
