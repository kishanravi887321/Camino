const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const vscode = require('vscode');
const robot = require('robotjs');

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

    const imagePath = path.join(__dirname, 'test.png');

    if (fs.existsSync(imagePath)) {
      try {
        await copyFileToClipboard(imagePath);
        await sleep(500);
        robot.keyTap('v', ['control']);
        await sleep(1000);
      } catch (error) {
        vscode.window.showWarningMessage(`Could not paste test.png: ${error.message}`);
      }
    }

    robot.typeString('Analyze this issue from the image and fix it.');
    robot.keyTap('enter');
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};