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
  const platform = process.platform;

  if (platform === 'win32') {
    const escapedPath = filePath.replace(/'/g, "''");
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

  if (platform === 'darwin') {
    // Use AppleScript/osascript to read the file and set it as a TIFF picture on clipboard.
    const script = `set the clipboard to (read (POSIX file "${filePath}") as TIFF picture)`;

    return new Promise((resolve, reject) => {
      execFile('osascript', ['-e', script], (error, stdout, stderr) => {
        if (error) {
          reject(new Error(error.message + '\n' + stderr));
          return;
        }

        resolve();
      });
    });
  }

  // Linux (try wl-copy then xclip)
  if (platform === 'linux') {
    return new Promise((resolve, reject) => {
      // check for wl-copy
      execFile('which', ['wl-copy'], (errWl) => {
        if (!errWl) {
          // use wl-copy
          const cmd = `wl-copy --type image/png < '${filePath.replace(/'/g, "'\\''")}'`;
          execFile('bash', ['-lc', cmd], (err, stdout, stderr) => {
            if (err) {
              reject(new Error(err.message + '\n' + stderr));
              return;
            }

            resolve();
          });
          return;
        }

        // check for xclip
        execFile('which', ['xclip'], (errX) => {
          if (!errX) {
            const cmd = `xclip -selection clipboard -t image/png -i '${filePath.replace(/'/g, "'\\''")}'`;
            execFile('bash', ['-lc', cmd], (err2, stdout2, stderr2) => {
              if (err2) {
                reject(new Error(err2.message + '\n' + stderr2));
                return;
              }

              resolve();
            });
            return;
          }

          reject(new Error('No clipboard image tool found: install wl-clipboard (wl-copy) or xclip')); 
        });
      });
    });
  }

  return Promise.reject(new Error('Unsupported platform for image clipboard'));
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