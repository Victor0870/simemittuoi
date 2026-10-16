type AuthErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

/** Chuyển lỗi Supabase Auth (tiếng Anh) sang thông báo tiếng Việt dễ hiểu cho đoàn viên. */
export function translateAuthError(error: AuthErrorLike): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "Email hoặc mật khẩu không đúng. Bấm biểu tượng con mắt để xem lại mật khẩu: kiểm tra chữ HOA/thường và bộ gõ tiếng Việt (Telex/VNI) có tự đổi ký tự không.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "Email chưa được xác nhận. Vui lòng liên hệ Ban chấp hành để được hỗ trợ.";
  }
  if (code === "user_already_exists" || /already registered/i.test(message)) {
    return "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.";
  }
  if (code === "weak_password" || /password should be/i.test(message)) {
    return "Mật khẩu quá ngắn hoặc quá yếu (tối thiểu 6 ký tự).";
  }
  if (code === "validation_failed" || /invalid format|unable to validate email/i.test(message)) {
    return "Email không hợp lệ. Vui lòng kiểm tra lại (không có dấu cách, dạng ten@gmail.com).";
  }
  if (code === "over_request_rate_limit" || error?.status === 429 || /rate limit/i.test(message)) {
    return "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
  }
  if (/failed to fetch|network|load failed/i.test(message)) {
    return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng (Wi-Fi/4G) rồi thử lại.";
  }
  return message || "Đã xảy ra lỗi. Vui lòng thử lại.";
}

export function normalizeEmail(email: string): string {
  return email.replace(/\s+/g, "").toLowerCase();
}
