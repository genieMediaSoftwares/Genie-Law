#!/usr/bin/env node
/**
 * Publishes a legal document version, or seeds placeholders to work against.
 *
 * The app never writes legal text. These are operator actions: the wording
 * must come from your legal counsel, and `--reviewed` should be passed only
 * once that review has happened.
 *
 * Seed placeholders (marked unreviewed, acceptance off):
 *   node scripts/publishLegalDocument.js --seed
 *
 * Publish real content from a file and make it the active version:
 *   node scripts/publishLegalDocument.js \
 *     --type client_terms --version 1.0 --title "Client Terms" \
 *     --file ./client-terms.txt --effective 2026-10-01 \
 *     --audience client --requires-acceptance --reviewed
 *
 * Publishing a new version deactivates the previous one of the same type.
 * Users are then asked to accept the new version; their old acceptance record
 * is kept as history.
 */
require("../src/config/env");
const fs = require("fs");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const LegalDocument = require("../src/models/LegalDocument");

const { LEGAL_DOCUMENT_TYPES, AUDIENCES } = LegalDocument;

const arg = (name, fallback = undefined) => {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : true;
};

const PLACEHOLDERS = [
  { type: "platform_terms", title: "Platform Terms of Use", audience: "all" },
  { type: "client_terms", title: "Client Terms", audience: "client" },
  { type: "lawyer_terms", title: "Advocate Terms", audience: "lawyer" },
  { type: "privacy_policy", title: "Privacy Policy", audience: "all" },
  { type: "refund_policy", title: "Payment & Refund Policy", audience: "all" },
  { type: "ai_disclaimer", title: "AI Assistance Disclaimer", audience: "all" },
];

const placeholderBody = (title) =>
  [
    `${title} — PLACEHOLDER, NOT LEGAL TEXT.`,
    "",
    "This document has not been drafted or reviewed by a lawyer. It exists so",
    "the application has something to display and so acceptance can be tested.",
    "Replace it with counsel-approved wording before launch, using:",
    "",
    "  node scripts/publishLegalDocument.js --type <type> --version <v> \\",
    "    --title <title> --file <path> --effective <YYYY-MM-DD> --reviewed",
    "",
    "Until then this version is marked as not legally reviewed, and acceptance",
    "is switched off.",
  ].join("\n");

async function publish({
  type,
  version,
  title,
  content,
  effectiveDate,
  audience,
  requiresAcceptance,
  legallyReviewed,
}) {
  await LegalDocument.updateMany({ type, isActive: true }, { isActive: false });

  const document = await LegalDocument.findOneAndUpdate(
    { type, version },
    {
      type,
      version,
      title,
      content,
      effectiveDate,
      audience,
      requiresAcceptance,
      legallyReviewed,
      isActive: true,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(
    `published ${document.type} v${document.version}` +
      `${document.legallyReviewed ? "" : "  (NOT legally reviewed)"}` +
      `${document.requiresAcceptance ? "  (acceptance required)" : ""}`
  );
}

async function main() {
  await connectDatabase();

  if (arg("seed")) {
    for (const item of PLACEHOLDERS) {
      await publish({
        ...item,
        version: "0.1-placeholder",
        content: placeholderBody(item.title),
        effectiveDate: new Date(),
        requiresAcceptance: false,
        legallyReviewed: false,
      });
    }
    console.log(
      "\nPlaceholders seeded. They are shown to users but not required to be accepted."
    );
    return;
  }

  const type = arg("type");
  const version = arg("version");
  const title = arg("title");
  const file = arg("file");

  if (!type || !version || !title || !file) {
    console.error(
      "Required: --type --version --title --file  (see the header of this file)"
    );
    process.exitCode = 1;
    return;
  }

  if (!LEGAL_DOCUMENT_TYPES.includes(type)) {
    console.error(`--type must be one of: ${LEGAL_DOCUMENT_TYPES.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const audience = arg("audience", "all");
  if (!AUDIENCES.includes(audience)) {
    console.error(`--audience must be one of: ${AUDIENCES.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const effective = arg("effective");
  const effectiveDate = effective ? new Date(effective) : new Date();
  if (Number.isNaN(effectiveDate.getTime())) {
    console.error("--effective must be a valid date, e.g. 2026-10-01");
    process.exitCode = 1;
    return;
  }

  await publish({
    type,
    version,
    title,
    content: fs.readFileSync(file, "utf8"),
    effectiveDate,
    audience,
    requiresAcceptance: Boolean(arg("requires-acceptance")),
    legallyReviewed: Boolean(arg("reviewed")),
  });

}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
