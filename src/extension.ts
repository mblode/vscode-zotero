import * as vscode from 'vscode';
import requestPromise from 'request-promise';

interface ZoteroConfig {
  port: number;
}

/**
 * Resolve the text editor we should act on.
 *
 * `vscode.window.activeTextEditor` is undefined on some surfaces — most
 * notably notebook/.qmd editors in Positron — even though the user is
 * clearly typing into a cell. In that case fall back to the text editor
 * backing the active notebook cell.
 */
function resolveActiveEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return editor;
  }

  const notebookEditor = vscode.window.activeNotebookEditor;
  if (notebookEditor) {
    const selection = notebookEditor.selection;
    const cell = notebookEditor.notebook.cellAt(selection.start);
    if (cell) {
      const cellEditor = vscode.window.visibleTextEditors.find(
        candidate => candidate.document.uri.toString() === cell.document.uri.toString()
      );
      if (cellEditor) {
        return cellEditor;
      }
    }
  }

  return undefined;
}

async function showZoteroPicker(): Promise<void> {
  const config: ZoteroConfig = vscode.workspace.getConfiguration('zotero-citation-picker') as any;

  try {
    const result: string = await requestPromise(String(config.port));
    if (result) {
      const editor = resolveActiveEditor();
      if (editor) {
        await editor.edit(editBuilder => {
          editor.selections.forEach(selection => {
            editBuilder.delete(selection);
            editBuilder.insert(selection.start, result);
          });
        });
      } else {
        // No text editor or notebook cell to insert into (common on some
        // Positron surfaces). Don't lose the citation — put it on the
        // clipboard and tell the user.
        await vscode.env.clipboard.writeText(result);
        vscode.window.showInformationMessage(
          'Zotero Citations: no active editor to insert into, so the citation was copied to your clipboard.'
        );
      }
    }
  } catch (err: any) {
    console.log('Failed to fetch citation: %j', err.message);
    vscode.window.showErrorMessage('Zotero Citations: could not connect to Zotero. Are you sure it is running?');
  }
}

async function openInZotero(): Promise<void> {
  const editor = resolveActiveEditor();

  if (!editor) {
    return;
  }

  let citeKey: string = '';

  if (editor.selection.isEmpty) {
    const range = editor.document.getWordRangeAtPosition(editor.selection.active);
    if (range) {
      citeKey = editor.document.getText(range);
    }
  } else {
    citeKey = editor.document.getText(new vscode.Range(editor.selection.start, editor.selection.end));
  }

  console.log(`Opening ${citeKey} in Zotero`);
  const uri = vscode.Uri.parse(`zotero://select/items/bbt:${citeKey}`);
  await vscode.env.openExternal(uri);
}

async function openPDFZotero(): Promise<void> {
  const editor = resolveActiveEditor();

  if (!editor) {
    return;
  }

  let citeKey: string = '';

  if (editor.selection.isEmpty) {
    const range = editor.document.getWordRangeAtPosition(editor.selection.active);
    if (range) {
      citeKey = editor.document.getText(range);
    }
  } else {
    citeKey = editor.document.getText(new vscode.Range(editor.selection.start, editor.selection.end));
  }

  console.log(`Opening ${citeKey} in Zotero`);

  const options = {
    method: 'POST',
    uri: 'http://localhost:23119/better-bibtex/json-rpc',
    body: {
      'jsonrpc': '2.0',
      'method': 'item.attachments',
      'params': [citeKey]
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  };

  let uri = vscode.Uri.parse(`zotero://select/items/bbt:${citeKey}`);

  try {
    const repos: any = await requestPromise(options);
    console.log(repos['result']);
    console.log('User has %d repos', repos['result'].length);
    for (const elt of repos['result']) {
      if (elt['path'].endsWith('.pdf')) {
        uri = vscode.Uri.parse(elt['open']);
        break;
      }
    }
    console.log(uri);
    await vscode.env.openExternal(uri);
  } catch (err: any) {
    console.log('API open PDF in Zotero failed', err);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  console.log('Congratulations, your extension "zotero citation picker" is now active!');

  context.subscriptions.push(vscode.commands.registerCommand('extension.openInZotero', openInZotero));
  context.subscriptions.push(vscode.commands.registerCommand('extension.openPDFZotero', openPDFZotero));

  let disposable = vscode.commands.registerCommand('extension.zoteroCitationPicker', () => {
    showZoteroPicker();
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // This function is called when the extension is deactivated
}
