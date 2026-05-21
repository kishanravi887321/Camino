const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const vscode = require('vscode');
let robot = null; // lazy-loaded to avoid crashing activation if native module fails

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
  const escapedPath = filePath.replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$files = New-Object System.Collections.Specialized.StringCollection',
    `$files.Add('${escapedPath}') | Out-Null`,
    '[System.Windows.Forms.Clipboard]::SetFileDropList($files)'
  ].join('; ');

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', script],
      (error) => {
        if (error) {
          reject(error);
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

    // Try to load robotjs only when the command runs. If it fails, show a warning
    // but continue so the extension doesn't crash on activation.
    if (!robot) {
      try {
        robot = require('robotjs');
      } catch (err) {
        vscode.window.showWarningMessage('robotjs failed to load: ' + err.message);
      }
    }

    const imagePath = path.join(__dirname, 'test.png');

    if (fs.existsSync(imagePath)) {
      try {
        await copyFileToClipboard(imagePath);
        await sleep(500);
        if (robot) {
          robot.keyTap('v', ['control']);
          await sleep(1000);
        } else {
          vscode.window.showInformationMessage('Image copied to clipboard; please paste manually into Copilot Chat.');
        }
      } catch (error) {
        vscode.window.showWarningMessage(`Could not paste test.png: ${error.message}`);
      }
    }

    const prompt = 'Analyze this issue from the image and fix it.';

    if (robot) {
      robot.typeString(prompt);
      robot.keyTap('enter');
    } else {
      // Fallback: try the built-in type command to send the prompt to the focused input
      try {
        await vscode.commands.executeCommand('type', { text: prompt + '\n' });
      } catch (err) {
        vscode.window.showInformationMessage('Could not auto-type prompt; please paste or type: ' + prompt);
      }
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};