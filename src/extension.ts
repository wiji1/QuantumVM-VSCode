import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // Get server path from configuration
  const config = workspace.getConfiguration('qasmLanguageServer');
  let serverPath = config.get<string>('serverPath') || 'qasm-lsp';

  // If path is not absolute, try to find it in the workspace
  if (!path.isAbsolute(serverPath)) {
    // Try to find the binary in the workspace
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const localPath = path.join(workspaceFolder.uri.fsPath, 'target', 'release', 'qasm-lsp');
      const debugPath = path.join(workspaceFolder.uri.fsPath, 'target', 'debug', 'qasm-lsp');

      // Check if local build exists
      const fs = require('fs');
      if (fs.existsSync(localPath)) {
        serverPath = localPath;
      } else if (fs.existsSync(debugPath)) {
        serverPath = debugPath;
      }
    }
  }

  console.log(`Using QASM LSP server: ${serverPath}`);

  // Server options
  const serverOptions: ServerOptions = {
    command: serverPath,
    args: [],
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'qasm' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.qasm')
    }
  };

  // Create and start the client
  client = new LanguageClient(
    'qasmLanguageServer',
    'QASM Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
