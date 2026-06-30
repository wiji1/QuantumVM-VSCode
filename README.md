# QuantumVM — OpenQASM Extension for VS Code

OpenQASM 3.0 support for VS Code with LSP integration and runtime execution.
## Features

- **Syntax Highlighting** — Full grammar for OpenQASM 3.0 files (`.qasm`)
- **One-Click Execution** — Run QASM files directly from the editor via the play button in the title bar, the context menu, or the keyboard shortcut
- **Language Server Protocol** — Diagnostics, completions, and more via the QASM language server
- **Auto-Update** — Automatically downloads the latest binary releases from GitHub

## Requirements

- **VS Code** ^1.75.0
- The QASM language server binary (`qasm-lsp`) — the extension will download it automatically on first use, or you can point to a custom path via the `qasmLanguageServer.serverPath` setting.

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=quantumvm.qasm-language-support), or download and install the `.vsix` from the [GitHub Releases](https://github.com/wiji1/QuantumVM-VSCode/releases) page.

## Usage

1. Open any `.qasm` file.
2. Click the **play** button in the editor title bar, or right-click and select **Run QASM File**, or press `Cmd+Shift+R` (macOS) / `Ctrl+Shift+R` (Windows/Linux).

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `qasmLanguageServer.serverPath` | `qasm-lsp` | Path to the QASM language server executable |
| `qasmLanguageServer.trace.server` | `off` | Traces VS Code ↔ language server communication |
| `quantumvm.autoUpdate` | `true` | Automatically download binary updates on startup |

## Development

1. Clone the repo and install dependencies:
   ```
   git clone https://github.com/wiji1/QuantumVM-VSCode.git
   cd QuantumVM-VSCode
   npm install
   ```
2. Compile the TypeScript:
   ```
   npm run compile
   ```
3. Press `F5` in VS Code to launch a new Extension Development Host window.
4. To package a `.vsix` for distribution, install `@vscode/vsce` and run:
   ```
   npx @vscode/vsce package
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [QuantumVM Repository](https://github.com/wiji1/QuantumVM)
- [Visual Studio Marketplace Extension Page](https://marketplace.visualstudio.com/items?itemName=quantumvm.qasm-language-support)
