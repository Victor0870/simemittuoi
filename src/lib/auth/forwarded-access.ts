import { parseAccess, type AccessInfo } from "@/lib/auth/permissions";

/**
 * Middleware đã gọi cdilv_my_permissions cho trang được bảo vệ thì chuyển kết quả xuống
 * trang qua header nội bộ này, để getCurrentAccess không phải gọi lại RPC trong cùng request.
 * Header được ký HMAC bằng khóa bí mật phía máy chủ, gắn với user id và có hạn ngắn:
 * header do trình duyệt tự gửi lên không thể giả mạo.
 */
export const FORWARDED_ACCESS_HEADER = "x-cdilv-access";

const TTL_MS = 60_000;
const SIGNING_CONTEXT = "cdilv-forwarded-access-v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type ForwardedPayload = {
  uid: string;
  exp: number;
  raw: unknown;
};

function signingSecret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${SIGNING_CONTEXT}.${data}`),
  );
  return toBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Ký kết quả thô của cdilv_my_permissions; null nếu không có khóa ký (khi đó trang tự gọi RPC). */
export async function signForwardedAccess(userId: string, raw: unknown): Promise<string | null> {
  const secret = signingSecret();
  if (!secret) return null;
  const payload: ForwardedPayload = { uid: userId, exp: Date.now() + TTL_MS, raw };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, body)}`;
}

/** Trả về quyền nếu header hợp lệ, đúng người dùng và còn hạn; ngược lại null. */
export async function verifyForwardedAccess(
  value: string,
  userId: string,
): Promise<AccessInfo | null> {
  const secret = signingSecret();
  if (!secret) return null;

  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra !== undefined) return null;

  try {
    if (!safeEqual(signature, await hmac(secret, body))) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as Partial<ForwardedPayload>;
    if (payload.uid !== userId) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return parseAccess(payload.raw);
  } catch {
    return null;
  }
}
