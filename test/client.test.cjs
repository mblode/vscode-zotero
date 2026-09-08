const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load, server } = require("./helpers.cjs");
const { pickerURL, rpcURL, requestText, rpc, pdfURL, errorMessage } =
  load("src/client.ts");
const { selectedKey, keyAtPosition } = load("src/citekey.ts");

for (const value of [
  "not a URL",
  "file:///tmp/file",
  "https://user:pass@localhost/cayw",
  "http://localhost/#x",
])
  test(`reject invalid endpoint ${value}`, () =>
    assert.throws(() => pickerURL(value), /URL/));
test("preserve custom port, options and reverse proxy prefix", () => {
  const u = pickerURL(
    "http://localhost:24119/proxy/better-bibtex/cayw?format=eta&template=a%2Bb&minimize=true",
  );
  assert.equal(u.searchParams.get("template"), "a+b");
  assert.equal(
    rpcURL(u).href,
    "http://localhost:24119/proxy/better-bibtex/json-rpc",
  );
});
for (const [language, format] of [
  ["latex", "biblatex"],
  ["plaintex", "biblatex"],
  ["typst", "typst"],
  ["markdown", "pandoc"],
  ["quarto", "pandoc"],
])
  test(`auto format ${language}`, () =>
    assert.equal(
      pickerURL(undefined, "auto", language).searchParams.get("format"),
      format,
    ));
test("explicit URL format preserved by default", () =>
  assert.equal(
    pickerURL("http://localhost/cayw?format=natbib").searchParams.get("format"),
    "natbib",
  ));
test("direct HTTP ignores proxy environment and sends User-Agent", async () => {
  const env = process.env;
  const before = [env.HTTP_PROXY, env.http_proxy, env.NO_PROXY];
  env.HTTP_PROXY = env.http_proxy = "http://127.0.0.1:1";
  env.NO_PROXY = "";
  const s = await server((req, res) => {
    assert.match(req.headers["user-agent"], /vscode-zotero/);
    res.end("@Müller:2026-test");
  });
  try {
    assert.equal(await requestText(s.url), "@Müller:2026-test");
  } finally {
    for (const [i, k] of ["HTTP_PROXY", "http_proxy", "NO_PROXY"].entries()) {
      if (before[i] === undefined) delete env[k];
      else env[k] = before[i];
    }
    await s.close();
  }
});
for (const status of [301, 404, 500])
  test(`HTTP ${status} fails rather than inserting an error page`, async () => {
    const s = await server((_req, res) => {
      res.writeHead(status, { Location: "/redirect" });
      res.end("error");
    });
    try {
      await assert.rejects(requestText(s.url), (e) => e.code === "HTTP");
    } finally {
      await s.close();
    }
  });
test("UTF-8 survives split response chunks", async () => {
  const bytes = Buffer.from("é漢字");
  const s = await server((_req, res) => {
    res.write(bytes.subarray(0, 1));
    res.end(bytes.subarray(1));
  });
  try {
    assert.equal(await requestText(s.url), "é漢字");
  } finally {
    await s.close();
  }
});
test("timeout bounds an unresponsive server", async () => {
  const s = await server(() => {});
  try {
    await assert.rejects(
      requestText(s.url, { timeout: 25 }),
      (e) => e.code === "TIMEOUT",
    );
  } finally {
    await s.close();
  }
});
test("incomplete HTTP response is never returned as a citation", async () => {
  const s = await server((_req, res) => {
    res.writeHead(200, { "Content-Length": 100 });
    res.write("@partial");
    setImmediate(() => res.destroy());
  });
  try {
    await assert.rejects(requestText(s.url), (error) =>
      ["CONNECTION", "ECONNRESET"].includes(error.code),
    );
  } finally {
    await s.close();
  }
});
test("cancellation aborts a pending request", async () => {
  const s = await server(() => {});
  try {
    const c = new AbortController();
    const request = requestText(s.url, { signal: c.signal });
    c.abort();
    await assert.rejects(request, (e) => e.name === "AbortError");
  } finally {
    await s.close();
  }
});
test("response size is bounded", async () => {
  const s = await server((_req, res) => res.end("oversized"));
  try {
    await assert.rejects(
      requestText(s.url, { maxBytes: 3 }),
      (e) => e.code === "SIZE",
    );
  } finally {
    await s.close();
  }
});
test("JSON-RPC uses the configured server and complete key", async () => {
  let data;
  const s = await server((req, res) => {
    assert.equal(req.url, "/better-bibtex/json-rpc");
    assert.equal(req.method, "POST");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      data = JSON.parse(body);
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: [] }));
    });
  });
  try {
    assert.deepEqual(
      await rpc(s.url, "item.attachments", ["Smith:2026-a"]),
      [],
    );
    assert.deepEqual(data, {
      jsonrpc: "2.0",
      id: 1,
      method: "item.attachments",
      params: ["Smith:2026-a"],
    });
  } finally {
    await s.close();
  }
});
for (const [name, response] of [
  ["invalid JSON", "oops"],
  ["bad envelope", "{}"],
  ["wrong id", '{"jsonrpc":"2.0","id":2,"result":[]}'],
  ["missing result", '{"jsonrpc":"2.0","id":1}'],
  [
    "RPC error",
    '{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"key not found"}}',
  ],
])
  test(name, async () => {
    const s = await server((_q, r) => r.end(response));
    try {
      await assert.rejects(rpc(s.url, "item.attachments"));
    } finally {
      await s.close();
    }
  });
test("PDF lookup skips links, absent paths and unsafe URLs; accepts uppercase PDF", () =>
  assert.equal(
    pdfURL([
      { path: false },
      { path: null },
      { path: "/note.html" },
      { path: "/bad.pdf", open: "https://example.com" },
      { path: "/FILE.PDF", open: "zotero://open-pdf/library/items/ABCDEFGH" },
    ]),
    "zotero://open-pdf/library/items/ABCDEFGH",
  ));
test("no attachments falls back; malformed collection errors", () => {
  assert.equal(pdfURL([]), undefined);
  assert.throws(() => pdfURL({}), /attachment list/);
});
test("current Zotero 10 attachment response is understood", () => {
  const live = require("./fixtures/zotero-10.json");
  assert.equal(pdfURL(live.attachments), live.pdf);
});
test("connection failure has actionable diagnostic", () =>
  assert.match(errorMessage({ code: "ECONNREFUSED" }), /Start Zotero/));
test("suppressed-author citation is recognized at both prefix characters", () => {
  for (const column of [1, 2, 3, 7])
    assert.equal(keyAtPosition("[-@Smith:2026-a]", column), "Smith:2026-a");
});
for (const [input, expected] of [
  ["Smith:2026-a", "Smith:2026-a"],
  ["[@Smith:2026-a]", "Smith:2026-a"],
  ["-@Müller_2026", "Müller_2026"],
  ["\\autocite[see][p. 5]{Smith:2026-a}", "Smith:2026-a"],
  ["@a; @b", undefined],
  ["\\cite{a,b}", undefined],
  ["", undefined],
])
  test(`selected key ${input}`, () =>
    assert.equal(selectedKey(input), expected));
for (const [line, column, key] of [
  ["See @Smith:2026-a.", 12, "Smith:2026-a"],
  ["[@Müller_2026]", 7, "Müller_2026"],
  ["\\cite{one-key,two.key}", 17, "two.key"],
  ["\\cite{one}", 3, undefined],
  ["[see @Smith-2026, p. 3]", 11, "Smith-2026"],
])
  test(`cursor key ${line}`, () =>
    assert.equal(keyAtPosition(line, column), key));
