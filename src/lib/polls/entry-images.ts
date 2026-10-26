import { createHash } from "node:crypto";

const DATA_IMAGE_RE = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

export const MAX_ENTRY_IMAGES = 3;

export function parseStoredImageUrls(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? safeJsonArray(raw) : [];
  return list.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, MAX_ENTRY_IMAGES);
}

function safeJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isRemoteImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function entryImageVersion(stored: string): string {
  return createHash("sha1").update(stored).digest("hex").slice(0, 16);
}

/** Ảnh base64 lưu trong DB được thay bằng đường dẫn tới route ảnh (cache lâu theo phiên bản); link http(s) giữ nguyên. */
export function toPublicEntryImageUrls(pollId: string, optionId: string, raw: unknown): string[] {
  return parseStoredImageUrls(raw).flatMap((stored, index) => {
    if (isRemoteImageUrl(stored)) return [stored];
    if (!DATA_IMAGE_RE.test(stored)) return [];
    return [`/api/polls/${pollId}/entries/${optionId}/images/${index}?v=${entryImageVersion(stored)}`];
  });
}

export function decodeDataImage(stored: string): { contentType: string; body: Buffer } | null {
  const match = DATA_IMAGE_RE.exec(stored);
  if (!match) return null;
  const contentType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  return { contentType, body: Buffer.from(match[2], "base64") };
}
