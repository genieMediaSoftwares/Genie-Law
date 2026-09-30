const { readZipEntry } = require("../ai/docxExtractor");

const MAX_BLOCKS = 2000;

const decodeXml = (value) =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const splitBlocks = (xml) => {
  const blocks = [];
  const pattern = /<w:(p|tbl)(?:\s[^>]*)?(\/?)>/g;
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    const tag = match[1];
    const selfClosing = match[2] === "/";
    const start = match.index;

    if (selfClosing) {
      blocks.push({ tag, xml: match[0] });
      continue;
    }

    const open = new RegExp(`<w:${tag}(?:\\s[^>]*)?>`, "g");
    const close = new RegExp(`</w:${tag}>`, "g");
    let depth = 1;
    let cursor = pattern.lastIndex;

    while (depth > 0 && cursor < xml.length) {
      open.lastIndex = cursor;
      close.lastIndex = cursor;
      const nextOpen = open.exec(xml);
      const nextClose = close.exec(xml);

      if (!nextClose) break;

      if (nextOpen && nextOpen.index < nextClose.index) {
        depth += 1;
        cursor = nextOpen.index + nextOpen[0].length;
      } else {
        depth -= 1;
        cursor = nextClose.index + nextClose[0].length;
      }
    }

    blocks.push({ tag, xml: xml.slice(start, cursor) });
    pattern.lastIndex = cursor;
  }

  return blocks;
};

const parseRuns = (paragraphXml) => {
  const runs = [];
  const runPattern = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let match;

  while ((match = runPattern.exec(paragraphXml)) !== null) {
    const runXml = match[1];
    const properties = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(runXml)?.[1] ?? "";

    const isOn = (tag) => {
      const found = new RegExp(`<w:${tag}(\\s[^>]*)?/?>`).exec(properties);
      if (!found) return false;
      const val = /w:val="([^"]*)"/.exec(found[1] || "")?.[1];
      return val === undefined || !["0", "false", "none"].includes(val);
    };

    let text = "";
    const piecePattern = /<w:(t|tab|br)(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:\1>)/g;
    let piece;
    while ((piece = piecePattern.exec(runXml)) !== null) {
      if (piece[1] === "t") text += decodeXml(piece[2] ?? "");
      else if (piece[1] === "tab") text += "\t";
      else text += "\n";
    }

    if (!text) continue;

    runs.push({
      text,
      bold: isOn("b"),
      italic: isOn("i"),
      underline: isOn("u"),
    });
  }

  return runs;
};

const headingLevel = (paragraphXml) => {
  const style = /<w:pStyle\s+w:val="([^"]*)"/.exec(paragraphXml)?.[1] ?? "";
  const heading = /^heading\s*([1-6])$/i.exec(style.replace(/[-_]/g, " "));
  if (heading) return Number(heading[1]);
  if (/^title$/i.test(style)) return 1;
  return 0;
};

const parseParagraph = (paragraphXml) => {
  const runs = parseRuns(paragraphXml);
  const text = runs.map((r) => r.text).join("");

  if (!text.trim()) return { type: "spacer" };

  const level = headingLevel(paragraphXml);
  if (level > 0) return { type: "heading", level, text, runs };

  const numbering = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(paragraphXml)?.[1];
  if (numbering) {
    const indent = Number(/<w:ilvl\s+w:val="(\d+)"/.exec(numbering)?.[1] ?? 0);
    return { type: "listItem", indent, text, runs };
  }

  return { type: "paragraph", text, runs };
};

const parseTable = (tableXml) => {
  const rows = [];
  const rowPattern = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(tableXml)) !== null) {
    const cells = [];
    const cellPattern = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const cellText = splitBlocks(cellMatch[1])
        .filter((b) => b.tag === "p")
        .map((b) => parseRuns(b.xml).map((r) => r.text).join(""))
        .join("\n")
        .trim();
      cells.push(cellText);
    }

    if (cells.length) rows.push(cells);
  }

  return rows.length ? { type: "table", rows } : null;
};

const docxToBlocks = (buffer) => {
  const documentXml = readZipEntry(buffer, "word/document.xml");
  if (!documentXml) {
    throw new Error("Not a readable .docx archive (no word/document.xml).");
  }

  const xml = documentXml.toString("utf8");
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;

  const blocks = [];
  let truncated = false;

  for (const block of splitBlocks(body)) {
    if (blocks.length >= MAX_BLOCKS) {
      truncated = true;
      break;
    }

    if (block.tag === "p") {
      const parsed = parseParagraph(block.xml);
      if (parsed.type === "spacer") {
        if (blocks.length === 0 || blocks[blocks.length - 1].type === "spacer") {
          continue;
        }
      }
      blocks.push(parsed);
    } else {
      const table = parseTable(block.xml);
      if (table) blocks.push(table);
    }
  }

  while (blocks.length && blocks[blocks.length - 1].type === "spacer") {
    blocks.pop();
  }

  return { blocks, truncated };
};

module.exports = { docxToBlocks, MAX_BLOCKS };
