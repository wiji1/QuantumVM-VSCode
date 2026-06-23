import * as path from 'path';
import * as fs from 'fs';
import { workspace, ExtensionContext, window } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';
import { ensureLspBinary } from './downloader';

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    const config = workspace.getConfiguration('qasmLanguageServer');
    let serverPath = config.get<string>('serverPath');

    if (!serverPath || serverPath === 'qasm-lsp') {
        const workspaceFolder = workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const localPath = path.join(workspaceFolder.uri.fsPath, 'target', 'release', 'qasm-lsp');
            const debugPath = path.join(workspaceFolder.uri.fsPath, 'target', 'debug', 'qasm-lsp');

            if (fs.existsSync(localPath)) serverPath = localPath;
            else if (fs.existsSync(debugPath)) serverPath = debugPath;
        }

        if (!serverPath || !fs.existsSync(serverPath)) {
            try {
                serverPath = await ensureLspBinary(context);
            } catch (error) {
                window.showErrorMessage('Failed to download QASM Language Server. Please configure a custom path in settings.');
                return;
            }
        }
    }

    console.log(`Using QASM LSP server: ${serverPath}`);

    const serverOptions: ServerOptions = {
        command: serverPath,
        args: [],
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'qasm' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.qasm')
        }
    };

    client = new LanguageClient(
        'qasmLanguageServer',
        'QASM Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) return undefined;
    return client.stop();
}
