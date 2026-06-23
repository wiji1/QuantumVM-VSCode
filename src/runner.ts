import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureVmBinary } from './downloader';

const execFileAsync = promisify(execFile);

let outputChannel: vscode.OutputChannel;

export function initializeRunner(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('QuantumVM');
    context.subscriptions.push(outputChannel);

    const runCommand = vscode.commands.registerCommand('qasm.runFile', async () => {
        await runCurrentFile(context);
    });
    context.subscriptions.push(runCommand);

    const codeLensProvider = new QasmCodeLensProvider();
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: 'file', language: 'qasm' },
        codeLensProvider
    );
    context.subscriptions.push(codeLensDisposable);
}

async function runCurrentFile(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'qasm') {
        vscode.window.showErrorMessage('Current file is not a QASM file');
        return;
    }

    if (document.isDirty) await document.save();

    const filePath = document.uri.fsPath;

    try {
        const vmPath = await ensureVmBinary(context);

        outputChannel.clear();
        outputChannel.show(true);

        const { stdout, stderr } = await execFileAsync(vmPath, [filePath], {
            timeout: 30000
        });

        if (stdout) {
            outputChannel.appendLine(stdout);
        }

        if (stderr) outputChannel.appendLine(stderr);

    } catch (error: any) {
        if (error.code === 'ETIMEDOUT') {
            outputChannel.appendLine('Error: Execution timed out (30 seconds)');
        } else if (error.stdout) outputChannel.appendLine(error.stdout);

        if (error.stderr) outputChannel.appendLine(error.stderr);
        else if (error.message) outputChannel.appendLine(error.message);

        vscode.window.showErrorMessage('Failed to run QASM file. See output for details.');
    }
}

class QasmCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const topOfDocument = new vscode.Range(0, 0, 0, 0);
        const runCodeLens = new vscode.CodeLens(topOfDocument, {
            title: '▶ Run',
            command: 'qasm.runFile',
            tooltip: 'Run this QASM file with QuantumVM'
        });

        return [runCodeLens];
    }
}
