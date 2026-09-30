const zlib = require("zlib");

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

const STORED = 0;
const DEFLATED = 8;

const findEndOfCentralDirectory = (buffer) => {
  const earliest = Math.max(0, buffer.length - (22 + 0xffff));
  for (let i = buffer.length - 22; i >= earliest; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
};

const readZipEntry = (buffer, wantedName) => {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === -1) return null;

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buffer.length) return null;
    if (buffer.readUInt32LE(offset) !== CENTRAL_FILE_SIGNATURE) return null;

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (name === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) return null;

      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === STORED) return data;
      if (compressionMethod === DEFLATED) return zlib.inflateRawSync(data);
      return null;
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return null;
};

const decodeXmlEntities = (value) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const extractDocxText = (buffer) => {
  const documentXml = readZipEntry(buffer, "word/document.xml");
  if (!documentXml) {
    throw new Error("Not a readable .docx archive (no word/document.xml).");
  }

  const xml = documentXml.toString("utf8");

  const withBreaks = xml
    .replace(/<w:p[\s>]/g, "\n<w:p ")
    .replace(/<w:br\s*\/?>/g, "\n")
    .replace(/<w:tab\s*\/?>/g, " ");

  const runs = withBreaks.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  if (runs.length === 0) return "";

  let text = "";
  let cursor = 0;
  for (const run of runs) {
    const at = withBreaks.indexOf(run, cursor);
    const between = withBreaks.slice(cursor, at);
    if (between.includes("\n")) text += "\n";
    text += decodeXmlEntities(run.replace(/<[^>]+>/g, ""));
    cursor = at + run.length;
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
};

module.exports = { extractDocxText, readZipEntry };
