"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";
import { CDILV_RPC, CDILV_STORAGE } from "@/lib/supabase/tables";

type AvatarRpcResult = {
  ok: boolean;
  message?: string;
  awarded?: boolean;
  points?: number;
  avatar_url?: string;
};

type Props = {
  userId: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  avatarUrl: string | null;
  hasAvatarBonus: boolean;
  levels: string[];
  score: number;
  rank: number;
  isApproved: boolean;
};

export function AccountInfo(props: Props) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(props.avatarUrl);
  const [hasAvatarBonus, setHasAvatarBonus] = useState(props.hasAvatarBonus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh (JPG, PNG, WEBP, GIF).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ảnh tối đa 2MB.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${props.userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(CDILV_STORAGE.avatars)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setSaving(false);
      setError(uploadError.message);
      return;
    }

    const { data: pub } = supabase.storage.from(CDILV_STORAGE.avatars).getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;
    const { data, error: rpcError } = await supabase.rpc(CDILV_RPC.updateMyAvatar, { p_avatar_url: publicUrl });
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const result = data as AvatarRpcResult;
    if (!result?.ok) {
      setError(result?.message ?? "Không cập nhật được ảnh đại diện.");
      return;
    }

    setAvatarUrl(result.avatar_url ?? publicUrl);
    if (result.awarded) {
      setHasAvatarBonus(true);
      setMessage("Đã cập nhật ảnh đại diện và nhận +10 điểm thưởng.");
    } else {
      setMessage("Đã cập nhật ảnh đại diện.");
    }
    void refreshProfile();
    router.refresh();
  }

  const name = props.fullName || "Đoàn viên";

  return (
    <div className="space-y-4 pb-6 sm:space-y-5 sm:pb-10">
      <h1 className="text-xl font-extrabold text-[#173A67] sm:text-headline-md">Thông tin tài khoản</h1>

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-4 sm:text-left">
          <label className="group relative h-24 w-24 shrink-0 cursor-pointer" title="Đổi ảnh đại diện">
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-primary-fixed bg-primary-fixed text-3xl font-extrabold text-[#173A67]">
              <Avatar alt={name} fallback={name.slice(0, 1)} size={96} src={avatarUrl} />
            </span>
            <span className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#173A67] text-white shadow-md transition group-hover:scale-110">
              <MaterialIcon className="text-[18px]" name={saving ? "progress_activity" : "photo_camera"} />
            </span>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={saving}
              type="file"
              onChange={handleAvatarChange}
            />
          </label>
          <div className="w-full min-w-0 flex-1 space-y-1.5">
            <p className="break-words text-lg font-extrabold text-[#173A67] sm:text-xl">{name}</p>
            <p className="break-words text-sm text-on-surface-variant">
              {[props.employeeCode ? `Mã NV ${props.employeeCode}` : null, props.department]
                .filter(Boolean)
                .join(" · ") || "Chưa có mã nhân viên"}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {props.levels.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 rounded-full bg-[#D9F2EC] px-2.5 py-0.5 text-xs font-bold text-[#173A67]"
                >
                  <MaterialIcon className="text-[14px]" name="military_tech" />
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-on-surface-variant sm:mt-4 sm:text-left">
          Bấm vào ảnh để đổi ảnh đại diện (JPG, PNG, WEBP, GIF · tối đa 2MB).{" "}
          {hasAvatarBonus ? "Bạn đã nhận thưởng cập nhật ảnh đại diện." : "Lần đầu cập nhật: +10 điểm."}
        </p>
        {error ? (
          <p className="mt-3 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container">{message}</p>
        ) : null}
      </section>

      {props.isApproved ? (
        <section className="grid grid-cols-2 gap-3">
          <Link
            className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 transition hover:border-[#173A67] sm:p-4"
            href="/score-history"
          >
            <p className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
              <MaterialIcon className="text-[16px]" name="stars" />
              Điểm thi đua
            </p>
            <p className="text-2xl font-extrabold text-[#173A67] sm:text-headline-md">
              {props.score.toLocaleString("vi-VN")}
            </p>
            <span className="text-xs font-semibold text-primary">Lịch sử điểm →</span>
          </Link>
          <Link
            className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 transition hover:border-[#173A67] sm:p-4"
            href="/leaderboard"
          >
            <p className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
              <MaterialIcon className="text-[16px]" name="leaderboard" />
              Xếp hạng
            </p>
            <p className="text-2xl font-extrabold text-[#173A67] sm:text-headline-md">
              {props.rank > 0 ? `#${props.rank}` : "—"}
            </p>
            <span className="text-xs font-semibold text-primary">Bảng xếp hạng →</span>
          </Link>
        </section>
      ) : null}

      <Link
        className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 transition hover:border-[#173A67] sm:p-4"
        href="/settings/password"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D9F2EC] text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="password" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#173A67]">Đổi mật khẩu</span>
          <span className="block text-xs text-on-surface-variant">Đặt mật khẩu mới cho tài khoản đăng nhập</span>
        </span>
        <MaterialIcon className="text-[20px] text-on-surface-variant" name="chevron_right" />
      </Link>

      <p className="text-xs text-on-surface-variant sm:text-sm">
        Thưởng đăng ký tài khoản (+10) được cộng tự động khi bạn đăng ký thành công.
      </p>
    </div>
  );
}
