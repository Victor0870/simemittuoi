import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * ID người đang đăng nhập (null nếu chưa đăng nhập). getClaims() xác thực JWT cục bộ
 * (signing key bất đối xứng), chỉ gọi Auth server khi cần. Gọi nhiều lần trong 1 request chỉ xác thực 1 lần.
 */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});
