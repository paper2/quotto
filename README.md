# Quotto - Beautiful Quote Image Generator

> **⚠️ 注意 / Notice**
> このリポジトリは [taross-f/quotto](https://github.com/taross-f/quotto) からforkした個人利用目的の改造版です。オリジナルとは異なる変更が含まれており、公式サポートはありません。
>
> This is a personal fork of [taross-f/quotto](https://github.com/taross-f/quotto) for private use. It contains modifications not present in the original and is not officially supported.

---

A CLI tool to generate beautiful quote images inspired by e-reader aesthetics, built with TypeScript, Bun, and Ink.

## Features

- 📚 Generate beautiful quote images with customizable text
- 🎨 Clean, minimalist design inspired by e-reader interfaces
- 📝 Support for multiline quotes with `\n` escape sequences
- ⚡ Fast execution with Bun runtime
- 🌐 Web UI for easy image generation in the browser

## Installation

```bash
git clone https://github.com/paper2/quotto.git
cd quotto
bun install
```

## Usage

### Web UI

ブラウザから手軽に画像を生成できます。サーバーを起動すると自動でブラウザが開きます。

```bash
bun run web
```

`http://localhost:47321` でUIが起動します。フォームにQuote・Title・Authorを入力して「画像を生成」を押すと、画像がプレビュー表示されダウンロードできます。生成された画像は `web/output/` に保存されます。

### CLI

```bash
# Basic
bun run start --quote "Your inspiring quote here"

# With all options
bun run start \
  --quote "Innovation distinguishes\nbetween a leader and a follower." \
  --title "Various Interviews" \
  --author "Steve Jobs" \
  --output "my-quote.png"
```

#### Options

| Option     | Required | Description                                               |
| ---------- | -------- | --------------------------------------------------------- |
| `--quote`  | ✅        | Quote text. Supports `\n` for line breaks                 |
| `--title`  | optional | Book or source title                                      |
| `--author` | optional | Author name                                               |
| `--output` | optional | Output filename (default: `quotto-quote-[timestamp].png`) |

## Project structure

```
quotto/
├── src/
│   ├── cli.tsx              # Main CLI interface
│   ├── cli-commander.ts     # Command line argument parser
│   ├── image-generator.ts   # SVG-based image generation
│   └── constants.ts         # Default config
├── web/
│   ├── index.html           # Web UI
│   └── server.ts            # Local web server
└── tests/
```

## Development

```bash
bun test          # Run tests
bun run lint      # Lint
bun run format    # Format
```

## Example Output

![Sample Quote Image](sample.png)

## License

MIT — see [LICENSE](LICENSE). This fork retains the original copyright notice as required.
