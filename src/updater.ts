import * as vscode from 'vscode';
import { fetchLatestRelease, ensureLspBinary, ensureVmBinary } from './downloader';

interface BinaryVersions {
    lsp?: string;
    vm?: string;
}

const VERSION_STORAGE_KEY = 'installedBinaryVersions';

function getStoredVersions(context: vscode.ExtensionContext): BinaryVersions {
    return context.globalState.get<BinaryVersions>(VERSION_STORAGE_KEY, {});
}

async function setStoredVersions(context: vscode.ExtensionContext, versions: BinaryVersions): Promise<void> {
    await context.globalState.update(VERSION_STORAGE_KEY, versions);
}

function compareVersions(currentVersion: string | undefined, latestVersion: string): boolean {
    if (!currentVersion) return true;

    return currentVersion !== latestVersion;
}

async function checkForUpdates(context: vscode.ExtensionContext): Promise<string | null> {
    try {
        const release = await fetchLatestRelease();
        const latestVersion = release.tag_name;
        const storedVersions = getStoredVersions(context);

        if (compareVersions(storedVersions.lsp, latestVersion) ||
            compareVersions(storedVersions.vm, latestVersion)) {
            return latestVersion;
        }

        return null;
    } catch (error) {
        console.error('Failed to check for updates:', error);
        return null;
    }
}

async function performUpdate(context: vscode.ExtensionContext, version: string): Promise<boolean> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating QuantumVM binaries...',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Downloading LSP server...' });
            await ensureLspBinary(context, true);

            progress.report({ message: 'Downloading QuantumVM...' });
            await ensureVmBinary(context, true);

            progress.report({ message: 'Update complete!' });
        });

        await setStoredVersions(context, {
            lsp: version,
            vm: version
        });

        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to update binaries: ${errorMessage}`);
        return false;
    }
}

async function promptReload(version: string): Promise<void> {
    const message = `QuantumVM binaries updated to ${version}. Reload to apply changes.`;
    const action = await vscode.window.showInformationMessage(message, 'Reload Now', 'Later');

    if (action === 'Reload Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}

export async function checkAndUpdate(context: vscode.ExtensionContext): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('quantumvm');
        const autoUpdate = config.get<boolean>('autoUpdate', true);

        if (!autoUpdate) {
            console.log('Auto-update disabled');
            return;
        }

        console.log('Checking for binary updates...');
        const latestVersion = await checkForUpdates(context);

        if (!latestVersion) {
            console.log('Binaries are up to date');
            return;
        }

        console.log(`Update available: ${latestVersion}`);
        const success = await performUpdate(context, latestVersion);

        if (success) await promptReload(latestVersion);
    } catch (error) {
        console.error('Update check failed:', error);
    }
}

export async function manualUpdateCheck(context: vscode.ExtensionContext): Promise<void> {
    try {
        const latestVersion = await checkForUpdates(context);

        if (!latestVersion) {
            vscode.window.showInformationMessage('QuantumVM binaries are already up to date.');
            return;
        }

        const message = `Update available: ${latestVersion}. Download now?`;
        const action = await vscode.window.showInformationMessage(message, 'Update', 'Cancel');

        if (action === 'Update') {
            const success = await performUpdate(context, latestVersion);
            if (success) await promptReload(latestVersion);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to check for updates: ${errorMessage}`);
    }
}

export async function storeInitialVersion(context: vscode.ExtensionContext): Promise<void> {
    try {
        const storedVersions = getStoredVersions(context);

        if (!storedVersions.lsp || !storedVersions.vm) {
            const release = await fetchLatestRelease();
            const version = release.tag_name;

            await setStoredVersions(context, {
                lsp: version,
                vm: version
            });

            console.log(`Initial version stored: ${version}`);
        }
    } catch (error) {
        console.error('Failed to store initial version:', error);
    }
}
