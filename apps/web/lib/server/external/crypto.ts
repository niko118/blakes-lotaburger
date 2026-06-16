import "server-only";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Validate encryption key on module load
if (!process.env.EXTERNAL_TOKENS_ENC_KEY) {
  throw new Error(
    "EXTERNAL_TOKENS_ENC_KEY is required for token encryption. Generate with: openssl rand -base64 32"
  );
}

const encryptionKey = Buffer.from(
  process.env.EXTERNAL_TOKENS_ENC_KEY,
  "base64"
);

if (encryptionKey.length !== KEY_LENGTH) {
  throw new Error(
    `EXTERNAL_TOKENS_ENC_KEY must be ${KEY_LENGTH} bytes (base64 encoded). Current: ${encryptionKey.length} bytes`
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns Base64-encoded string in format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param encrypted Base64-encoded string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 */
export function decrypt(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted format. Expected: iv:authTag:ciphertext"
    );
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length}, expected ${IV_LENGTH}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: ${authTag.length}, expected ${AUTH_TAG_LENGTH}`
    );
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Generate SHA-256 fingerprint of a value for audit purposes
 * @param value The value to fingerprint
 * @returns Hex-encoded SHA-256 hash
 */
export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

