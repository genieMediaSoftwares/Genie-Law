const crypto = require("crypto");
const { required } = require("../config/env");

const ALGORITHM = "aes-256-gcm";

const SECRET_KEY = crypto.createHash("sha256").update(required("ENCRYPTION_SECRET")).digest();

function encrypt(text) {
  if (!text || typeof text !== "string") return text;
  if (text.startsWith("enc:")) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(text) {
  if (!text || typeof text !== "string" || !text.startsWith("enc:")) return text;

  try {
    const parts = text.slice(4).split(":");
    if (parts.length !== 3) return text;
    const [ivHex, authTagHex, encryptedHex] = parts;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err.message);
    return text;
  }
}

module.exports = { encrypt, decrypt };
