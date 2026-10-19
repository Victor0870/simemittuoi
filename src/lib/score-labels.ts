/**
 * award_label vừa là khóa chống cộng trùng do hệ thống sinh ra (post_comment_<uuid>, signup_bonus…),
 * vừa là tên giải admin tự nhập ("Giải ILV Nhì"). Chỉ tên giải mới nên hiển thị cho người xem.
 */
export function readableAwardLabel(label: string | null | undefined): string | null {
  const value = label?.trim();
  if (!value) return null;
  return /^[A-Za-z0-9_-]+$/.test(value) ? null : value;
}
