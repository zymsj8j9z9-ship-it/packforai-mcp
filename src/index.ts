#!/usr/bin/env node
/**
 * PackForAI MCP server.
 *
 * Exposes a `convert_document` tool that turns PDF, DOCX, PPTX, XLSX, CSV and
 * JSON files into clean, compact, AI-ready Markdown via the PackForAI API, so
 * Claude, Cursor and other MCP clients can convert documents inline.
 *
 * Auth: set PACKFORAI_API_KEY (get one at https://packforai.com/account, Pro plan).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const API_BASE = process.env.PACKFORAI_BASE_URL ?? "https://packforai.com/api/v1";
const API_KEY = process.env.PACKFORAI_API_KEY;

const server = new McpServer({ name: "packforai", version: "0.1.1" });

server.registerTool(
  "convert_document",
  {
    title: "Convert a document to clean, AI-ready Markdown",
    description:
      "Convert a document (PDF, DOCX, PPTX, XLSX, CSV, JSON) into clean, compact, AI-ready Markdown using PackForAI. " +
      "Provide either a local file `path` or a public `url`. Returns the compact Markdown plus token-savings, ready to " +
      "read or paste into a prompt. Use `ocr: true` for scanned / image-only PDFs.",
    inputSchema: {
      path: z.string().optional().describe("Absolute path to a local document file to convert."),
      url: z.string().optional().describe("Public https URL of a document to fetch and convert."),
      ocr: z.boolean().optional().describe("Force OCR for scanned or image-only PDFs (Pro). Defaults to false."),
      full: z
        .boolean()
        .optional()
        .describe("Return the full document.md (e.g. complete spreadsheet tables) instead of the compact version. Defaults to false.")
    }
  },
  async ({ path, url, ocr, full }) => {
    if (!API_KEY) {
      return errorResult(
        "PACKFORAI_API_KEY is not set. Create a key at https://packforai.com/account (Pro plan) and set it in this MCP server's config."
      );
    }
    if (!path && !url) {
      return errorResult("Provide either `path` (a local file) or `url` (a public document URL).");
    }

    // 1. Read the document bytes.
    let bytes: Uint8Array;
    let filename: string;
    try {
      if (path) {
        bytes = new Uint8Array(await readFile(path));
        filename = basename(path);
      } else {
        const res = await fetch(url as string);
        if (!res.ok) return errorResult(`Could not fetch the URL: ${res.status} ${res.statusText}`);
        bytes = new Uint8Array(await res.arrayBuffer());
        filename = filenameFromUrl(url as string);
      }
    } catch (error) {
      return errorResult(`Failed to read the document: ${errMsg(error)}`);
    }

    // 2. Submit to PackForAI, then poll until done.
    try {
      const form = new FormData();
      form.append("file", new Blob([bytes as unknown as BlobPart]), filename);
      form.append("ocr", ocr ? "true" : "false");

      const submit = await fetch(`${API_BASE}/convert`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: form
      });
      if (!submit.ok) {
        return errorResult(`PackForAI convert failed (${submit.status}): ${await safeError(submit)}`);
      }
      const submitJson = (await submit.json()) as { id?: string };
      const id = submitJson.id;
      if (!id) return errorResult("PackForAI did not return a job id.");

      const startedAt = Date.now();
      const timeoutMs = 5 * 60 * 1000;
      const query = full ? "?format=full" : "";
      let job: JobResult | null = null;

      while (Date.now() - startedAt <= timeoutMs) {
        await sleep(2000);
        const poll = await fetch(`${API_BASE}/jobs/${id}${query}`, {
          headers: { Authorization: `Bearer ${API_KEY}` }
        });
        if (!poll.ok) return errorResult(`Polling failed (${poll.status}): ${await safeError(poll)}`);
        job = (await poll.json()) as JobResult;
        if (job.status === "completed" || job.status === "failed") break;
      }

      if (!job || (job.status !== "completed" && job.status !== "failed")) {
        return errorResult("Timed out waiting for the conversion to finish (5 minutes).");
      }
      if (job.status === "failed") {
        return errorResult(`Conversion failed: ${job.error ?? "unknown error"}`);
      }

      const markdown = job.markdown ?? "";
      const tokens = job.tokens;
      const header =
        tokens && tokens.original != null
          ? `Converted "${filename}" — ${tokens.original} to ${tokens.compact} tokens (${tokens.savingsPercent}% smaller).\n\n`
          : `Converted "${filename}".\n\n`;
      return textResult(header + markdown);
    } catch (error) {
      return errorResult(`Conversion error: ${errMsg(error)}`);
    }
  }
);

type JobResult = {
  status: "queued" | "processing" | "completed" | "failed";
  markdown?: string;
  error?: string;
  tokens?: { original?: number; compact?: number; savingsPercent?: number };
};

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}
function errMsg(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function safeError(res: Response) {
  try {
    const json = (await res.json()) as { error?: string };
    return json?.error ?? JSON.stringify(json);
  } catch {
    return res.statusText;
  }
}
function filenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) ?? "document");
  } catch {
    return "document";
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("PackForAI MCP server running on stdio.");
