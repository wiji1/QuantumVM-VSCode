# OpenQASM 3.0 Interpreter and Language Support

Language support and interpreter for OpenQASM 3.0 with one-click execution.

## Features

- **Syntax Highlighting** — Full grammar for OpenQASM 3.0 files (`.qasm`)
- **One-Click Execution** — Run QASM files directly from the editor via the play button in the title bar, the context menu, or the keyboard shortcut
- **Language Server Protocol** — Diagnostics, completions, and more via the QASM language server
- **Auto-Update** — Automatically downloads the latest binary releases from GitHub

## Requirements

- **VS Code** ^1.75.0
- The QASM language server binary (`qasm-lsp`) — the extension will download it automatically on first use, or you can point to a custom path via the `qasmLanguageServer.serverPath` setting.

## Usage

1. Open any `.qasm` file.
2. Click the **play** button in the editor title bar, or right-click and select **Run QASM File**, or press `Cmd+Shift+R` (macOS) / `Ctrl+Shift+R` (Windows/Linux).

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `qasmLanguageServer.serverPath` | `qasm-lsp` | Path to the QASM language server executable |
| `qasmLanguageServer.trace.server` | `off` | Traces VS Code ↔ language server communication |
| `quantumvm.autoUpdate` | `true` | Automatically download binary updates on startup |

## Release Notes

See [CHANGELOG](https://github.com/wiji1/QuantumVM-VSCode/releases) for version history.

## Repository

[github.com/wiji1/QuantumVM-VSCode](https://github.com/wiji1/QuantumVM-VSCode)
