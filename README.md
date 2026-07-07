# PackForAI MCP server

Convert **PDF, DOCX, PPTX, XLSX, CSV and JSON** into clean, compact, AI-ready Markdown, directly inside Claude, Cursor and any other MCP client. Powered by [PackForAI](https://packforai.com).

Instead of pasting a messy PDF into your AI (broken text, lost tables, wasted tokens), ask your assistant to convert it first: it comes back as clean Markdown with up to 65% fewer tokens.

## What you need

- **Node.js 18+**
- A **PackForAI API key** (Pro plan). Create one at [packforai.com/account](https://packforai.com/account).

## Install

The server runs via `npx`, so there is nothing to install globally. Add it to your MCP client's config.

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config) and add:

```json
{
  "mcpServers": {
    "packforai": {
      "command": "npx",
      "args": ["-y", "packforai-mcp"],
      "env": { "PACKFORAI_API_KEY": "your_key_here" }
    }
  }
}
```

Restart Claude Desktop.

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "packforai": {
      "command": "npx",
      "args": ["-y", "packforai-mcp"],
      "env": { "PACKFORAI_API_KEY": "your_key_here" }
    }
  }
}
```

## Usage

Once connected, just ask your assistant, for example:

- "Convert `~/Downloads/Q4-report.pdf` to clean Markdown."
- "Fetch `https://example.com/spec.docx` and give me the AI-ready version."
- "Convert this scanned PDF with OCR: `/path/to/scan.pdf`."

### Tool

**`convert_document`**

| Param | Type | Description |
|-------|------|-------------|
| `path` | string | Absolute path to a local document file. |
| `url` | string | Public https URL of a document to fetch and convert. |
| `ocr` | boolean | Force OCR for scanned / image-only PDFs (Pro). Default `false`. |
| `full` | boolean | Return the full `document.md` (e.g. complete spreadsheet tables) instead of the compact version. Default `false`. |

Provide either `path` or `url`. Returns the Markdown plus a token-savings summary.

## Config

- `PACKFORAI_API_KEY` (required) — your PackForAI API key.
- `PACKFORAI_BASE_URL` (optional) — override the API base (defaults to `https://packforai.com/api/v1`).

## Links

- Website: [packforai.com](https://packforai.com)
- API docs: [packforai.com/docs](https://packforai.com/docs)

## License

MIT
