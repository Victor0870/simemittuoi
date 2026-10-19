export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** Cờ trong app_metadata: buộc đổi mật khẩu sau khi Ban chấp hành cấp mật khẩu tạm. */
export const MUST_CHANGE_PASSWORD_FLAG = "must_change_password";

export const CHANGE_PASSWORD_PATH = "/settings/password";

export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== "string" || !password) return "Vui lòng nhập mật khẩu mới.";
  if (password !== password.trim()) return "Mật khẩu không được có dấu cách ở đầu hoặc cuối.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu mới tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Mật khẩu mới tối đa ${PASSWORD_MAX_LENGTH} ký tự.`;
  return null;
}

export function mustChangePassword(appMetadata: unknown): boolean {
  return Boolean(
    appMetadata && typeof appMetadata === "object" && (appMetadata as Record<string, unknown>)[MUST_CHANGE_PASSWORD_FLAG] === true,
  );
}
