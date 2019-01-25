// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const editor = vscode.window.activeTextEditor;
const request = require('request-promise')

const showZoteroPicker = () => {
	return request(`http://127.0.0.1:23119/better-bibtex/cayw?format=pandoc`)
		.then(function(result) {
			if (result) {
				editor.edit(
					edit => editor.selections.forEach(
						selection => {
							edit.delete(selection);
							edit.insert(selection.start, result);
						}
					)
				);

				return;
			}
		})
		.catch(function(err) {
			console.log('Failed to fetch citation: %j', err.message);
			vscode.window.showErrorMessage('Zotero Citations: could not connect to Zotero. Are you sure it is running?');
		});
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "zotero citation picker" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.zoteroCitationPicker', function() {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		showZoteroPicker();
	});

	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
};
