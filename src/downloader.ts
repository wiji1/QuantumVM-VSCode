import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

const GITHUB_REPO = 'wiji1/QuantumVM';
const LSP_BINARY_NAME = 'qasm-lsp';

interface PlatformInfo {
    platform: string;
    arch: string;
    extension: string;
}

function getPlatformInfo(): PlatformInfo {
    const platform = process.platform;
    const arch = process.arch;

    let platformName: string;
    let archName: string;
    let extension = '';

    if (platform === 'win32') {
        platformName = 'windows';
        extension = '.exe';
    } else if (platform === 'darwin') platformName = 'macos';
    else if (platform === 'linux') platformName = 'linux';
    else throw new Error(`Unsupported platform: ${platform}`);

    if (arch === 'x64') archName = 'x86_64';
    else if (arch === 'arm64') archName = 'aarch64';
    else throw new Error(`Unsupported architecture: ${arch}`);

    return { platform: platformName, arch: archName, extension };
}

function getAssetName(platformInfo: PlatformInfo): string {
    return `${LSP_BINARY_NAME}-${platformInfo.platform}-${platformInfo.arch}${platformInfo.extension}`;
}

async function fetchLatestRelease(): Promise<any> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/releases/latest`,
            headers: {
                'User-Agent': 'VSCode-QASM-Extension'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) resolve(JSON.parse(data));
                else reject(new Error(`Failed to fetch release: ${res.statusCode}`));
            });
        }).on('error', reject);
    });
}

async function downloadFile(url: string, dest: string, progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);

        https.get(url, {
            headers: {
                'User-Agent': 'VSCode-QASM-Extension'
            }
        }, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    file.close();
                    fs.unlinkSync(dest);
                    return downloadFile(redirectUrl, dest, progress).then(resolve).catch(reject);
                }
            }

            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (progress && totalSize > 0) {
                    const percentage = Math.floor((downloadedSize / totalSize) * 100);
                    progress.report({ message: `Downloading... ${percentage}%` });
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
        });
    });
}

function makeExecutable(filePath: string): void {
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(filePath, 0o755);
        } catch (err) {
            console.error('Failed to make file executable:', err);
        }
    }
}

export async function ensureLspBinary(context: vscode.ExtensionContext): Promise<string> {
    const platformInfo = getPlatformInfo();
    const assetName = getAssetName(platformInfo);
    const binaryPath = path.join(context.globalStorageUri.fsPath, assetName);

    if (fs.existsSync(binaryPath)) {
        makeExecutable(binaryPath);
        return binaryPath;
    }

    if (!fs.existsSync(context.globalStorageUri.fsPath)) {
        fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    }

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'QASM Language Server',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({message: 'Fetching latest release...'});
            const release = await fetchLatestRelease();

            const asset = release.assets.find((a: any) => a.name === assetName);
            if (!asset) {
                throw new Error(`No binary found for ${platformInfo.platform}-${platformInfo.arch}`);
            }

            progress.report({message: 'Downloading language server...'});
            await downloadFile(asset.browser_download_url, binaryPath, progress);

            makeExecutable(binaryPath);

            progress.report({message: 'Language server ready!'});

            return binaryPath;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to download QASM Language Server: ${errorMessage}`);
            throw error;
        }
    });
}