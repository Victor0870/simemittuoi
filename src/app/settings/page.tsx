"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";

type AvatarRpcResult = {
  ok: boolean;
  message?: string;
  awarded?: boolean;
  points?: number;
  avatar_url?: string;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasAvatarBonus, setHasAvatarBonus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const [{ data: profile }, { data: bonus }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("score_events")
          .select("id")
          .eq("user_id", user.id)
          .eq("award_label", "avatar_bonus")
          .maybeSingle(),
      ]);

      if (cancelled) return;

      setUserId(user.id);
      setFullName(profile?.full_name ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
      setHasAvatarBonus(Boolean(bonus?.id));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;

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
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setSaving(false);
      setError(uploadError.message);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;

    const { data, error: rpcError } = await supabase.rpc("update_my_avatar", {
      p_avatar_url: publicUrl,
    });

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
  }

  if (loading) {
    return (
      <AppShell activeHref="/settings">
        <div className="h-40 animate-pulse rounded-3xl bg-surface-container" />
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell activeHref="/settings">
        <div className="mx-auto max-w-lg rounded-3xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <h1 className="mb-2 text-headline-md text-[#173A67]">Cài đặt</h1>
          <p className="mb-6 text-on-surface-variant">
            Đăng nhập để cập nhật ảnh đại diện và nhận điểm thưởng.
          </p>
          <Link
            className="inline-flex rounded-xl bg-tertiary px-5 py-3 font-bold text-on-tertiary"
            href="/login"
          >
            Đăng nhập
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeHref="/settings">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-headline-xl font-extrabold text-[#173A67]">
            Cài đặt
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Cập nhật ảnh đại diện để nhận thưởng điểm (một lần).
          </p>
        </div>

        <section className="tonal-elevation-1 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-primary-fixed bg-primary-fixed text-3xl font-extrabold text-[#173A67]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={fullName || "Avatar"}
                  className="h-full w-full object-cover"
                  src={avatarUrl}
                />
              ) : (
                (fullName || "?").slice(0, 1)
              )}
            </div>
            <div>
              <p className="font-bold text-on-surface">{fullName || "Đoàn viên"}</p>
              <p className="text-sm text-on-surface-variant">
                {hasAvatarBonus
                  ? "Bạn đã nhận thưởng cập nhật avatar."
                  : "Lần đầu cập nhật avatar: +10 điểm."}
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low px-4 py-8 transition-colors hover:border-tertiary hover:bg-tertiary-container/40">
            <MaterialIcon className="text-3xl text-[#173A67]" name="add_a_photo" />
            <span className="font-bold text-on-surface">
              {saving ? "Đang tải lên..." : "Chọn ảnh đại diện"}
            </span>
            <span className="text-xs text-on-surface-variant">
              JPG, PNG, WEBP, GIF · tối đa 2MB
            </span>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={saving}
              type="file"
              onChange={handleAvatarChange}
            />
          </label>

          {error ? (
            <p className="mt-4 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container">
              {message}
            </p>
          ) : null}
        </section>

        <p className="text-sm text-on-surface-variant">
          Thưởng đăng ký tài khoản (+10) được cộng tự động khi bạn đăng ký thành
          công.
        </p>
      </div>
    </AppShell>
  );
}
