const path = require("path");
const zlib = require("zlib");
const gemini = require("./geminiClient");
const aiConfig = require("../../config/ai");
const { extractDocxText } = require("./docxExtractor");
const fileStore = require("../fileStore");

const TEXT_EXTENSIONS = new Set([".txt", ".text", ".md", ".csv", ".rtf"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif"]);

class OcrSanitizationService {
  async extractText(filePath, mimeType, originalName) {
    let rawText = "";
    let ocrQuality = "Good";
    let extractionFailed = false;
    let extractionError = null;
    const fraudFlags = [];

    try {
      const ext = path.extname(originalName || filePath).toLowerCase();
      // Uploads live in the file store (R2 or uploads/); filePath is the key.
      const content = await fileStore.read(filePath);

      if (ext === ".docx" || mimeType?.includes("wordprocessingml")) {
        const result = this._extractDocx(content);
        rawText = result.text;
        extractionFailed = result.extractionFailed;
        extractionError = result.error;
      } else if (ext === ".pdf" || mimeType?.includes("pdf")) {
        const result = await this._extractPdfText(content);
        rawText = result.text;
        extractionFailed = result.extractionFailed;
        extractionError = result.error;
        if (result.isScanned) ocrQuality = "Scanned OCR";
      } else if (IMAGE_EXTENSIONS.has(ext) || mimeType?.startsWith("image/")) {
        const result = await this._extractImageOcr(content, mimeType, filePath);
        rawText = result.text;
        extractionFailed = result.extractionFailed;
        extractionError = result.error;
      } else if (TEXT_EXTENSIONS.has(ext) || mimeType?.startsWith("text/")) {
        rawText = content ? content.toString("utf8") : "";
        if (!content) {
          extractionFailed = true;
          extractionError = "File not found in storage.";
        }
      } else {
        extractionFailed = true;
        extractionError = `Unsupported file type "${ext || mimeType || "unknown"}". Upload a PDF, image, DOCX or TXT.`;
      }

      const cleanLen = rawText.trim().length;

      if (extractionFailed) {
        ocrQuality = "Extraction Unavailable";
      } else if (cleanLen < 15) {
        ocrQuality = "Low Confidence";
        fraudFlags.push(
          `Very little readable text found in '${originalName}'. If this document should contain text, it may be blurred, skewed or a low-quality scan.`
        );
      }

      return {
        extractedText: this.sanitizeText(rawText),
        ocrQuality,
        fraudFlags,
        charCount: cleanLen,
        extractionFailed,
        extractionError,
      };
    } catch (err) {
      console.error(`OCR Extraction error for ${originalName}:`, err.message);
      return {
        extractedText: "",
        ocrQuality: "Extraction Unavailable",
        fraudFlags: [],
        charCount: 0,
        extractionFailed: true,
        extractionError: err.message,
      };
    }
  }

  async _extractImageOcr(content, mimeType, filePath) {
    if (!content) {
      return { text: "", extractionFailed: true, error: "File not found in storage." };
    }

    const base64Content = content.toString("base64");

    const { text, error } = await gemini.generate(
      [
        {
          inlineData: {
            mimeType: this._normalizeImageMime(mimeType, filePath),
            data: base64Content,
          },
        },
        {
          text:
            "Extract all legible text from this legal document image verbatim. " +
            "Return ONLY the extracted text, with no commentary. " +
            "If the image contains no readable text, return an empty response.",
        },
      ],
      { label: "ocr:image", timeoutMs: aiConfig.TIMEOUTS.ocr }
    );

    return { text: text || "", extractionFailed: text === null, error };
  }

  _normalizeImageMime(mimeType, filePath) {
    const supported = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
    if (mimeType && supported.includes(mimeType)) return mimeType;

    switch (path.extname(filePath).toLowerCase()) {
      case ".png":
        return "image/png";
      case ".webp":
        return "image/webp";
      default:
        return "image/jpeg";
    }
  }

  _extractDigitalPdfText(pdfBuffer) {
    try {
      const rawString = pdfBuffer.toString("latin1");

      const literalMatches =
        rawString.match(/\((.*?)\)\s*Tj/g) || rawString.match(/\[(.*?)\]\s*TJ/g);
      if (literalMatches && literalMatches.length > 5) {
        const text = literalMatches
          .map((m) => m.replace(/[()[\]]/g, "").replace(/Tj|TJ/g, "").trim())
          .filter(Boolean)
          .join(" ");
        if (this._looksLikeProse(text)) return text;
      }

      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let match;
      const decompressedParts = [];

      while ((match = streamRegex.exec(rawString)) !== null) {
        const chunk = match[1];
        if (!chunk || chunk.length < 10) continue;
        try {
          const buf = Buffer.from(chunk, "latin1");
          const inflated = zlib.unzipSync(buf).toString("latin1");
          decompressedParts.push(inflated);
        } catch {
          if (chunk.includes("BT") && chunk.includes("ET")) {
            decompressedParts.push(chunk);
          }
        }
      }

      if (decompressedParts.length > 0) {
        const fullDecompressed = decompressedParts.join("\n");
        const matches =
          fullDecompressed.match(/\((.*?)\)\s*Tj/g) ||
          fullDecompressed.match(/\[(.*?)\]\s*TJ/g) ||
          fullDecompressed.match(/[A-Za-z0-9\s.,;:'"()-]{15,}/g);

        if (matches && matches.length > 0) {
          const text = matches
            .map((m) => m.replace(/[()[\]]/g, "").replace(/Tj|TJ/g, "").trim())
            .filter((s) => s.length > 2)
            .join(" ");
          if (this._looksLikeProse(text)) return text;
        }
      }
    } catch (_) {}
    return "";
  }

  async _extractPdfText(pdfBuffer) {
    if (!pdfBuffer) {
      return { text: "", isScanned: false, extractionFailed: true, error: "File not found in storage." };
    }


    let textContent = this._extractDigitalPdfText(pdfBuffer);
    if (this._looksLikeProse(textContent)) {
      return { text: textContent, isScanned: false, extractionFailed: false, error: null };
    }
    textContent = "";

    const { text, error } = await gemini.generate(
      [
        { inlineData: { mimeType: "application/pdf", data: pdfBuffer.toString("base64") } },
        {
          text:
            "Extract all text from this legal PDF document, page by page, verbatim. " +
            "Return ONLY the extracted text, with no commentary.",
        },
      ],
      { label: "ocr:pdf", timeoutMs: aiConfig.TIMEOUTS.ocr }
    );

    if (text) {
      return { text, isScanned: true, extractionFailed: false, error: null };
    }

    if (!textContent) {
      try {
        const rawString = pdfBuffer.toString("latin1");
        const matches = rawString.match(/[A-Za-z0-9\s.,;:'"()-]{15,}/g);
        if (matches && matches.length > 0) {
          const extractedFallback = matches.filter((s) => s.trim().length > 20).join("\n");
          if (this._looksLikeProse(extractedFallback)) {
            textContent = extractedFallback;
          }
        }
      } catch (_) {}
    }

    return {
      text: textContent,
      isScanned: true,
      extractionFailed: !textContent,
      error: error || (textContent ? null : "OCR service unavailable"),
    };
  }

  _extractDocx(content) {
    if (!content) {
      return { text: "", extractionFailed: true, error: "File not found in storage." };
    }

    try {
      const text = extractDocxText(content);
      return { text, extractionFailed: false, error: null };
    } catch (e) {
      console.error("DOCX extraction error:", e.message);
      return { text: "", extractionFailed: true, error: e.message };
    }
  }

  _looksLikeProse(candidate) {
    const text = (candidate || "").trim();
    if (text.length < 80) return false;

    const printable = (text.match(/[\x20-\x7E\s]/g) || []).length;
    if (printable / text.length < 0.92) return false;

    const letters = (text.match(/[A-Za-z]/g) || []).length;
    if (letters / text.length < 0.5) return false;

    const words = text.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z'.,-]{2,}$/.test(w));
    return words.length >= 12;
  }

  sanitizeText(text) {
    if (!text || typeof text !== "string") return "";

    let sanitized = text;

    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /ignore\s+all\s+instructions/gi,
      /^[ \t]*system\s*:/gim,
      /^[ \t]*user\s*:/gim,
      /^[ \t]*assistant\s*:/gim,
      /\[INST\]/gi,
      /\[\/INST\]/gi,
      /<\|endoftext\|>/gi,
      /you\s+are\s+now\s+a/gi,
      /override\s+system\s+prompt/gi,
    ];

    for (const pattern of injectionPatterns) {
      sanitized = sanitized.replace(pattern, "[CLEANED_INJECTION_ATTEMPT]");
    }

    if (sanitized.length > 15000) {
      sanitized = sanitized.substring(0, 15000) + "... [Text truncated for processing limit]";
    }

    return sanitized.trim();
  }
}

module.exports = new OcrSanitizationService();
