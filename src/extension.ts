import * as vscode from "vscode";
import {
  DEFAULT_URL,
  errorMessage,
  isRecord,
  pdfURL,
  pickerURL,
  requestText,
  rpc,
} from "./client";
import { keyAtPosition, selectedKey } from "./citekey";

export function resolveActiveEditor(): vscode.TextEditor | undefined {
  if (vscode.window.activeTextEditor) return vscode.window.activeTextEditor;
  const notebook = vscode.window.activeNotebookEditor;
  if (!notebook || notebook.selection.start >= notebook.notebook.cellCount)
    return undefined;
  const uri = notebook.notebook
    .cellAt(notebook.selection.start)
    .document.uri.toString();
  return vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.toString() === uri,
  );
}
function settings(editor?: vscode.TextEditor) {
  const config = vscode.workspace.getConfiguration(
    "zotero-citation-picker",
    editor?.document,
  );
  const seconds = config.get<number>("timeout", 300);
  return {
    url: pickerURL(
      config.get("port", DEFAULT_URL),
      config.get("format", "configured"),
      editor?.document.languageId,
    ),
    timeout:
      (Number.isFinite(seconds) ? Math.max(10, Math.min(1800, seconds)) : 300) *
      1000,
  };
}
async function preserveCitation(
  citation: string,
  reason: string,
): Promise<void> {
  await vscode.env.clipboard.writeText(citation);
  void vscode.window.showInformationMessage(
    `Zotero: ${reason} Citation copied to your clipboard.`,
  );
}
function currentKey(editor?: vscode.TextEditor): string | undefined {
  if (!editor) return undefined;
  return editor.selection.isEmpty
    ? keyAtPosition(
        editor.document.lineAt(editor.selection.active.line).text,
        editor.selection.active.character,
      )
    : selectedKey(editor.document.getText(editor.selection));
}
async function openURL(url: string): Promise<void> {
  if (!(await vscode.env.openExternal(vscode.Uri.parse(url))))
    void vscode.window.showErrorMessage(
      "Zotero could not open this link. Check that Zotero is installed and handles zotero:// links.",
    );
}
export function activate(context: vscode.ExtensionContext): void {
  let picking = false;
  const controllers = new Set<AbortController>();
  context.subscriptions.push({
    dispose: () => {
      for (const controller of controllers) controller.abort();
      controllers.clear();
    },
  });
  const register = (id: string, command: () => Promise<void>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async () => {
        try {
          await command();
        } catch (error) {
          if (!(error instanceof Error && error.name === "AbortError"))
            void vscode.window.showErrorMessage(
              `Zotero: ${errorMessage(error)}`,
            );
        }
      }),
    );
  };
  register("extension.zoteroCitationPicker", async () => {
    if (picking) {
      void vscode.window.showInformationMessage(
        "Zotero: a citation picker is already open. Finish or cancel it before starting another.",
      );
      return;
    }
    const editor = resolveActiveEditor();
    const target = editor
      ? {
          editor,
          document: editor.document,
          version: editor.document.version,
          selections: [...editor.selections],
        }
      : undefined;
    const { url, timeout } = settings(editor);
    picking = true;
    const controller = new AbortController();
    controllers.add(controller);
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Choose citations in Zotero",
          cancellable: true,
        },
        async (_progress, token) => {
          const subscription = token.onCancellationRequested(() =>
            controller.abort(),
          );
          try {
            if (token.isCancellationRequested) controller.abort();
            const citation = await requestText(url, {
              timeout,
              signal: controller.signal,
            });
            if (!citation || controller.signal.aborted) return;
            if (!target) {
              await preserveCitation(citation, "No active text editor.");
              return;
            }
            if (
              target.document.isClosed ||
              target.document.version !== target.version
            ) {
              await preserveCitation(
                citation,
                "The original document changed or closed while you were choosing.",
              );
              return;
            }
            let applied = false;
            try {
              applied = await target.editor.edit((builder) => {
                for (const selection of target.selections)
                  builder.replace(selection, citation);
              });
            } catch {
              /* A closed or read-only editor can reject an otherwise valid edit. */
            }
            if (!applied)
              await preserveCitation(
                citation,
                "The original editor could not accept the citation.",
              );
          } finally {
            subscription.dispose();
          }
        },
      );
    } finally {
      picking = false;
      controllers.delete(controller);
    }
  });
  for (const [id, pdf] of [
    ["extension.openInZotero", false],
    ["extension.openPDFZotero", true],
  ] as const) {
    register(id, async () => {
      const editor = resolveActiveEditor();
      const key = currentKey(editor);
      if (!key) {
        void vscode.window.showInformationMessage(
          "Zotero: select one citation key or place the cursor inside it.",
        );
        return;
      }
      let url = `zotero://select/items/bbt:${encodeURIComponent(key)}`;
      if (pdf) {
        const controller = new AbortController();
        controllers.add(controller);
        try {
          const attachment = pdfURL(
            await rpc(
              settings(editor).url,
              "item.attachments",
              [key],
              controller.signal,
            ),
          );
          if (attachment) url = attachment;
          else
            void vscode.window.showInformationMessage(
              "Zotero: no PDF attachment was found. Opening the item instead.",
            );
        } finally {
          controllers.delete(controller);
        }
      }
      await openURL(url);
    });
  }
  register("extension.zoteroCheckConnection", async () => {
    const { url } = settings(resolveActiveEditor());
    const probe = new URL(url);
    probe.search = "";
    probe.searchParams.set("probe", "1");
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const ready = await requestText(probe, { signal: controller.signal });
      if (ready.trim() !== "ready") {
        void vscode.window.showWarningMessage(
          ready.trim() === "starting"
            ? "Zotero: Better BibTeX is still starting. Try again shortly."
            : "Zotero: the configured endpoint did not return a CAYW ready response.",
        );
        return;
      }
      let version = "";
      try {
        const data = await rpc(url, "api.ready", [], controller.signal);
        if (
          isRecord(data) &&
          typeof data.zotero === "string" &&
          typeof data.betterbibtex === "string"
        )
          version = ` Zotero ${data.zotero}; Better BibTeX ${data.betterbibtex}.`;
      } catch {
        /* Older BBT versions have CAYW but no api.ready method. */
      }
      if (controller.signal.aborted) return;
      void vscode.window.showInformationMessage(
        `Zotero: citation picker is ready.${version}`,
      );
    } finally {
      controllers.delete(controller);
    }
  });
}
