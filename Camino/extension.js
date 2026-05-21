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

function activate(context) {
  const disposable = vscode.commands.registerCommand('testcopilot.start', async () => {
    await openCopilotChat();
    await sleep(2000);

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