import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

const GITHUB_REPO = 'wiji1/QuantumVM';
const VM_BINARY_NAME = 'QuantumVM';

interface PlatformInfo {
    archName: string;
    platformName: string;
    archiveExtension: string;
    binaryExtension: string;
}

function getPlatformInfo(): PlatformInfo {
    const platform = process.platform;
    const arch = process.arch;

    let platformName: string;
    let archName: string;
    let archiveExtension: string;
    let binaryExtension = '';

    if (platform === 'win32') {
        platformName = 'pc-windows-msvc';
        archiveExtension = '.zip';
        binaryExtension = '.exe';
    } else if (platform === 'darwin') {
        platformName = 'apple-darwin';
        archiveExtension = '.tar.xz';
    } else if (platform === 'linux') {
        platformName = 'unknown-linux-gnu';
        archiveExtension = '.tar.xz';
    } else throw new Error(`Unsupported platform: ${platform}`);

    if (arch === 'x64') archName = 'x86_64';
    else if (arch === 'arm64') archName = 'aarch64';
    else throw new Error(`Unsupported architecture: ${arch}`);

    return { archName, platformName, archiveExtension, binaryExtension };
}

function getArchiveName(platformInfo: PlatformInfo): string {
    return `${VM_BINARY_NAME}-${platformInfo.archName}-${platformInfo.platformName}${platformInfo.archiveExtension}`;
}

export async function fetchLatestRelease(): Promise<any> {
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
    const tmpDest = dest + '.tmp';

    try { fs.unlinkSync(tmpDest); } catch { }

    await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(tmpDest);

        https.get(url, {
            headers: {
                'User-Agent': 'VSCode-QASM-Extension'
            }
        }, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    file.close();
                    try { fs.unlinkSync(tmpDest); } catch { }
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
            try { fs.unlinkSync(tmpDest); } catch { }
            reject(err);
        });
    });

    if (!fs.existsSync(tmpDest)) return;

    try {
        try { fs.unlinkSync(dest); } catch { }
        fs.renameSync(tmpDest, dest);
    } catch (err) {
        try { fs.unlinkSync(tmpDest); } catch { }
        const inUseHint = process.platform === 'win32' ? ' Please reload VS Code to complete the update.' : '';
        throw new Error(`Failed to replace binary at ${dest}. It may be in use by a running process.${inUseHint} ${err instanceof Error ? err.message : ''}`);
    }
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

async function extractArchive(archivePath: string, extractDir: string, platformInfo: PlatformInfo): Promise<void> {
    if (platformInfo.archiveExtension === '.tar.xz') {
        execSync(`tar xJf "${archivePath}" -C "${extractDir}"`, { stdio: 'pipe' });
    } else if (platformInfo.archiveExtension === '.zip') {
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`, { stdio: 'pipe' });
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function copyFileWithRetry(src: string, dest: string, maxRetries: number = 5): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            if (process.platform === 'win32' && fs.existsSync(dest)) {
                const oldPath = dest + '.old';
                try { fs.unlinkSync(oldPath); } catch { }
                try {
                    fs.renameSync(dest, oldPath);
                } catch {
                }
            } else try { fs.unlinkSync(dest); } catch { }
            fs.copyFileSync(src, dest);
            return;
        } catch (err: any) {
            if (attempt < maxRetries - 1 && err?.code === 'EBUSY') {
                const wait = 500 * Math.pow(2, attempt);
                await sleep(wait);
                continue;
            }
            const inUseHint = process.platform === 'win32' ? ' Please reload VS Code to complete the update.' : '';
            throw new Error(`Failed to replace binary at ${dest}. It may be in use by a running process.${inUseHint} ${err instanceof Error ? err.message : ''}`);
        }
    }
}

async function copyBinariesFromArchive(extractDir: string, storageDir: string, platformInfo: PlatformInfo): Promise<void> {
    const binaries = ['qasm-lsp', VM_BINARY_NAME];
    const archiveDirName = `${VM_BINARY_NAME}-${platformInfo.archName}-${platformInfo.platformName}`;

    for (const binaryName of binaries) {
        let srcPath: string | null = null;

        const subDir = path.join(extractDir, archiveDirName);
        if (fs.existsSync(subDir)) {
            const p = path.join(subDir, binaryName + platformInfo.binaryExtension);
            if (fs.existsSync(p)) srcPath = p;
        }

        if (!srcPath) {
            const p = path.join(extractDir, binaryName + platformInfo.binaryExtension);
            if (fs.existsSync(p)) srcPath = p;
        }

        if (srcPath) {
            const destPath = path.join(storageDir, binaryName + platformInfo.binaryExtension);
            await copyFileWithRetry(srcPath, destPath);
        }
    }
}

const downloadLocks = new Map<string, Promise<string>>();

async function ensureBinary(context: vscode.ExtensionContext, binaryName: string, title: string, forceDownload: boolean = false): Promise<string> {
    const platformInfo = getPlatformInfo();
    const binaryPath = path.join(context.globalStorageUri.fsPath, binaryName + platformInfo.binaryExtension);

    if (fs.existsSync(binaryPath) && !forceDownload) {
        makeExecutable(binaryPath);
        return binaryPath;
    }

    const lockKey = binaryName;
    const existing = downloadLocks.get(lockKey);
    if (existing) return existing;

    if (!fs.existsSync(context.globalStorageUri.fsPath)) {
        fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    }

    const promise = performDownload(context, platformInfo, binaryName, binaryPath, title);
    downloadLocks.set(lockKey, promise);

    try {
        return await promise;
    } finally {
        downloadLocks.delete(lockKey);
    }
}

async function performDownload(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInfo,
    binaryName: string,
    binaryPath: string,
    title: string
): Promise<string> {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: title,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Fetching latest release...' });
            const release = await fetchLatestRelease();

            const archiveName = getArchiveName(platformInfo);
            const asset = release.assets.find((a: any) => a.name === archiveName);
            if (!asset) {
                throw new Error(`No archive found for ${platformInfo.archName}-${platformInfo.platformName}`);
            }

            const tmpDir = path.join(context.globalStorageUri.fsPath, '.tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const archivePath = path.join(tmpDir, archiveName);
            const extractDir = path.join(tmpDir, 'extracted');

            try { fs.rmSync(extractDir, { recursive: true }); } catch { }
            fs.mkdirSync(extractDir, { recursive: true });

            progress.report({ message: 'Downloading...' });
            await downloadFile(asset.browser_download_url, archivePath, progress);

            progress.report({ message: 'Extracting...' });
            await extractArchive(archivePath, extractDir, platformInfo);

            await copyBinariesFromArchive(extractDir, context.globalStorageUri.fsPath, platformInfo);

            try { fs.rmSync(tmpDir, { recursive: true }); } catch { }

            if (!fs.existsSync(binaryPath)) {
                throw new Error(`Binary ${binaryName} not found in archive`);
            }

            makeExecutable(binaryPath);

            progress.report({ message: 'Ready!' });

            return binaryPath;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to download ${title}: ${errorMessage}`);
            throw error;
        }
    });
}

export async function ensureLspBinary(context: vscode.ExtensionContext, forceDownload: boolean = false): Promise<string> {
    return ensureBinary(context, 'qasm-lsp', 'QASM Language Server', forceDownload);
}

export async function ensureVmBinary(context: vscode.ExtensionContext, forceDownload: boolean = false): Promise<string> {
    return ensureBinary(context, VM_BINARY_NAME, 'QuantumVM', forceDownload);
}
