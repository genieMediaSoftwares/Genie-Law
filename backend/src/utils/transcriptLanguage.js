const TELUGU = [0x0c00, 0x0c7f];
const DEVANAGARI = [0x0900, 0x097f];

const SUPPORTED = new Set(["en", "hi", "te"]);

function detectTranscriptLanguage(text) {
  if (typeof text !== "string" || text.length === 0) return "";

  let latin = 0;
  let devanagari = 0;
  let telugu = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) latin++;
    else if (code >= DEVANAGARI[0] && code <= DEVANAGARI[1]) devanagari++;
    else if (code >= TELUGU[0] && code <= TELUGU[1]) telugu++;
  }

  if (!latin && !devanagari && !telugu) return "";
  if (telugu >= devanagari && telugu >= latin) return "te";
  if (devanagari >= latin) return "hi";
  return "en";
}

function normaliseLanguageCode(code) {
  if (typeof code !== "string") return "";
  const language = code.trim().toLowerCase().replace(/-/g, "_").split("_")[0];
  return SUPPORTED.has(language) ? language : "";
}

module.exports = { detectTranscriptLanguage, normaliseLanguageCode };
