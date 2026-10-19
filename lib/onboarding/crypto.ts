import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for creators' account passwords. The key lives only in the
// ONBOARDING_ENCRYPTION_KEY env var (32 random bytes, base64), never in the
// database, so a database leak alone doesn't expose any password.
// Stored format: v1:<iv>:<auth tag>:<ciphertext>, all base64.

function getKey(): Buffer {
  const raw = process.env.ONBOARDING_ENCRYPTION_KEY;
  if (!raw) throw new Error("Saving logins isn't set up yet (ONBOARDING_ENCRYPTION_KEY is missing).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ONBOARDING_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
