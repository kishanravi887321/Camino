const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const vscode = require('vscode');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openCopilotChat() {
  const commandsToTry = [
    'github.copilot-chat.focus',
    'workbench.action.chat.open'
  ];

  for (const commandId of commandsToTry) {
    try {
      await vscode.commands.executeCommand(commandId);
      return true;
    } catch {
      // Try the next command.
    }
  }

  return false;
}

function copyFileToClipboard(filePath) {
  // Use PowerShell to set the clipboard image (bitmap) so webviews and chat
  // inputs will accept Ctrl+V as an image paste. Uses System.Drawing + Forms.
  const escapedPath = filePath.replace("'", "''");
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    'Add-Type -AssemblyName System.Windows.Forms',
    `$img = [System.Drawing.Image]::FromFile('${escapedPath}')`,
    '[System.Windows.Forms.Clipboard]::SetImage($img)'
  ].join('; ');

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', script],
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(error.message + '\n' + stderr));
          return;
        }

        resolve();
      }
    );
  });
}

function activate(context) {
  const disposable = vscode.commands.registerCommand('testcopilot.start', async () => {
    await openCopilotChat();
    await sleep(2000);

    // We rely on copying the image to the clipboard and using VS Code's
    // `type` command to send the prompt. No native automation library is
    // required here to avoid native build issues.

    const imagePath = path.join(__dirname, 'test.png');

    if (fs.existsSync(imagePath)) {
      try {
        await copyFileToClipboard(imagePath);
        await sleep(500);

        // Try to trigger a paste via VS Code commands. Some webviews accept
        // the paste command; if it fails, ask the user to press Ctrl+V.
        let pasted = false;
        try {
          // Try the editor paste action
          await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
          pasted = true;
        } catch (e) {
          // ignore
        }

        if (!pasted) {
          try {
            await vscode.commands.executeCommand('paste');
            pasted = true;
          } catch (e) {
            // ignore
          }
        }

        if (!pasted) {
          vscode.window.showInformationMessage('Image copied to clipboard; please paste manually into Copilot Chat (Ctrl+V).');
        }
      } catch (error) {
        vscode.window.showWarningMessage(`Could not copy test.png to clipboard: ${error.message}`);
      }
    }

    const prompt = 'Analyze this issue from the image and fix it.';

    try {
      await vscode.commands.executeCommand('type', { text: prompt + '\n' });
    } catch (err) {
      vscode.window.showInformationMessage('Could not auto-type prompt; please paste or type: ' + prompt);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};