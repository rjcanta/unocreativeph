/** AES-256-GCM encryption for CRM credentials at rest. */
import crypto from "node:crypto";

function key(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set. Live credentials cannot be stored without it.");
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).");
  return buf;
}

export function encryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized credential format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** Verify a webhook signature (RSA/ECDSA/Ed25519 public key in PEM). */
export function verifyWebhookSignature(rawBody: string, signatureB64: string, publicKeyPem: string): boolean {
  try {
    const keyObj = crypto.createPublicKey(publicKeyPem);
    const sig = Buffer.from(signatureB64, "base64");
    const algo = keyObj.asymmetricKeyType === "ed25519" ? null : "sha256";
    return crypto.verify(algo, Buffer.from(rawBody), keyObj, sig);
  } catch {
    return false;
  }
}
