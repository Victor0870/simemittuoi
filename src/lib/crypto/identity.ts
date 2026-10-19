import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Mã hóa số CCCD bằng AES-256-GCM. Khóa 32 byte (base64) trong CDILV_IDENTITY_KEY.
 * Định dạng lưu: "v1:" + base64(iv 12 byte | tag 16 byte | ciphertext).
 * Mất khóa = không giải mã được số CCCD đã lưu.
 */

const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.CDILV_IDENTITY_KEY;
  if (!raw) throw new Error("Chưa cấu hình khóa mã hóa CCCD (CDILV_IDENTITY_KEY).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("Khóa mã hóa CCCD không hợp lệ (cần 32 byte base64).");
  return key;
}

export function normalizeIdNumber(raw: string): string {
  return raw.replace(/\s+/g, "");
}

export function isValidIdNumber(value: string): boolean {
  return /^\d{12}$/.test(value);
}

export function encryptIdNumber(idNumber: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(idNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

export function decryptIdNumber(payload: string): string {
  const [version, data] = payload.split(":");
  if (version !== VERSION || !data) throw new Error("Dữ liệu CCCD không đúng định dạng.");
  const buf = Buffer.from(data, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export function hashIdNumber(idNumber: string): string {
  return createHmac("sha256", getKey()).update(`cccd:${idNumber}`).digest("hex");
}

export function maskIdNumber(last4: string | null | undefined): string | null {
  return last4 ? `********${last4}` : null;
}
