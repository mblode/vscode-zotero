import * as http from "node:http";
import * as https from "node:https";

export const DEFAULT_URL =
  "http://127.0.0.1:23119/better-bibtex/cayw?format=pandoc";
export class ZoteroError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ZoteroError";
  }
}

export function pickerURL(
  value: unknown,
  format = "configured",
  language = "",
): URL {
  let url: URL;
  try {
    url = new URL(typeof value === "string" ? value : DEFAULT_URL);
  } catch {
    throw new ZoteroError(
      "Set Zotero Citation Picker: Port to a complete HTTP or HTTPS CAYW URL.",
      "CONFIG",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new ZoteroError(
      "Use an HTTP or HTTPS CAYW URL without credentials or a fragment.",
      "CONFIG",
    );
  }
  if (format === "auto")
    format = ["latex", "tex", "plaintex"].includes(language)
      ? "biblatex"
      : language === "typst"
        ? "typst"
        : "pandoc";
  if (format !== "configured") url.searchParams.set("format", format);
  return url;
}

export function rpcURL(picker: URL): URL {
  const url = new URL(picker);
  url.pathname = url.pathname.replace(/\/cayw\/?$/, "/json-rpc");
  if (url.pathname === picker.pathname)
    url.pathname = "/better-bibtex/json-rpc";
  url.search = "";
  url.hash = "";
  return url;
}

export function requestText(
  url: URL,
  options: {
    body?: string;
    timeout?: number;
    signal?: AbortSignal;
    maxBytes?: number;
  } = {},
): Promise<string> {
  const { body, signal, timeout = 10000, maxBytes = 1024 * 1024 } = options;
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    // A private agent connects directly, including when the editor inherits proxy variables.
    const agent = new transport.Agent({ keepAlive: false });
    const req = transport.request(url, {
      method: body === undefined ? "GET" : "POST",
      agent,
      signal,
      headers: {
        "User-Agent": "vscode-zotero/0.2.0",
        Accept: body === undefined ? "*/*" : "application/json",
        ...(body === undefined
          ? {}
          : {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            }),
      },
    });
    const timer = setTimeout(
      () =>
        req.destroy(
          new ZoteroError(
            "The request timed out. Close any pending Zotero picker and try again.",
            "TIMEOUT",
          ),
        ),
      timeout,
    );
    let settled = false;
    const finish = (error?: Error, value = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      agent.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    req.on("error", (error) => finish(error));
    req.on("response", (response) => {
      if (
        !response.statusCode ||
        response.statusCode < 200 ||
        response.statusCode >= 300
      ) {
        response.resume();
        finish(
          new ZoteroError(
            response.statusCode === 404
              ? "Better BibTeX CAYW was not found. Install or enable Better BibTeX and check the configured URL."
              : `Zotero returned HTTP ${response.statusCode}. Check Better BibTeX and the configured citation format.`,
            "HTTP",
          ),
        );
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          finish(
            new ZoteroError(
              "Zotero returned more than 1 MiB. Choose fewer items.",
              "SIZE",
            ),
          );
          response.destroy();
        } else chunks.push(chunk);
      });
      response.on("error", (error) => finish(error));
      response.on("aborted", () =>
        finish(
          new ZoteroError(
            "Zotero closed the connection before completing its response.",
            "CONNECTION",
          ),
        ),
      );
      response.on("end", () =>
        finish(undefined, Buffer.concat(chunks).toString("utf8")),
      );
    });
    req.end(body);
  });
}

export async function rpc(
  picker: URL,
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal,
): Promise<unknown> {
  const text = await requestText(rpcURL(picker), {
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ZoteroError("Better BibTeX returned invalid JSON.", "DATA");
  }
  if (!isRecord(data) || data.jsonrpc !== "2.0" || data.id !== 1)
    throw new ZoteroError(
      "Better BibTeX returned an invalid JSON-RPC response.",
      "DATA",
    );
  if (isRecord(data.error))
    throw new ZoteroError(
      `Better BibTeX: ${typeof data.error.message === "string" ? data.error.message : "request failed"}`,
      "RPC",
    );
  if (!Object.hasOwn(data, "result"))
    throw new ZoteroError("Better BibTeX returned no result.", "DATA");
  return data.result;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function pdfURL(value: unknown): string | undefined {
  if (!Array.isArray(value))
    throw new ZoteroError(
      "Better BibTeX returned an invalid attachment list.",
      "DATA",
    );
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.path !== "string" ||
      !/\.pdf$/i.test(item.path) ||
      typeof item.open !== "string"
    )
      continue;
    try {
      const url = new URL(item.open);
      if (url.protocol === "zotero:" && url.hostname === "open-pdf")
        return item.open;
    } catch {
      /* Ignore an unusable attachment. */
    }
  }
  return undefined;
}
export function errorMessage(error: unknown): string {
  if (error instanceof ZoteroError) return error.message;
  if (
    isRecord(error) &&
    [
      "ECONNREFUSED",
      "ENOTFOUND",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ECONNRESET",
    ].includes(String(error.code))
  )
    return "Could not reach Zotero. Start Zotero with Better BibTeX enabled, and check the configured host and port.";
  return "The Zotero request failed. Run Zotero: Check Connection to check your setup.";
}
