"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PRINT_LOGO_MAX_BYTES, PRINT_LOGO_TYPES } from "@/lib/print/logo";

type Props = { initialUrl: string | null };

/** Logo in ở góc trái Giấy đề nghị thanh toán – chỉ Quản trị viên thấy và sửa. */
export function PrintLogoSettings({ initialUrl }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File) {
    if (!PRINT_LOGO_TYPES[file.type]) {
      setMessage({ ok: false, text: "Chỉ hỗ trợ ảnh PNG hoặc JPG." });
      return;
    }
    if (file.size > PRINT_LOGO_MAX_BYTES) {
      setMessage({ ok: false, text: "Dung lượng logo tối đa là 2MB." });
      return;
    }
    setBusy("upload");
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/forms/settings/logo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Không tải được logo lên." });
        return;
      }
      setUrl(data.url ?? null);
      setMessage({ ok: true, text: "Đã lưu logo. Các phiếu in sau đó dùng logo mới." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Mất kết nối, vui lòng thử lại." });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Gỡ logo? Phiếu in sẽ để trống chỗ logo.")) return;
    setBusy("remove");
    setMessage(null);
    try {
      const res = await fetch("/api/forms/settings/logo", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Không gỡ được logo." });
        return;
      }
      setUrl(null);
      setMessage({ ok: true, text: "Đã gỡ logo." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Mất kết nối, vui lòng thử lại." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div>
        <h2 className="text-title-md font-bold text-[#173A67]">Logo trên Giấy đề nghị thanh toán</h2>
        <p className="text-xs text-on-surface-variant">
          In ở góc trái trên cùng của phiếu (bản xem trước và file Excel). Chưa có logo thì chỗ này để trống. Ảnh PNG
          hoặc JPG, tối đa 2MB.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-28 w-36 items-center justify-center rounded-xl border border-dashed border-outline-variant bg-white p-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Logo in trên phiếu" className="max-h-full max-w-full object-contain" src={url} />
          ) : (
            <span className="text-center text-xs text-on-surface-variant">Chưa có logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            accept="image/png,image/jpeg"
            className="hidden"
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#173A67] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-60"
            disabled={busy !== null}
            type="button"
            onClick={() => fileRef.current?.click()}
          >
            <MaterialIcon className="text-[18px]" name={busy === "upload" ? "progress_activity" : "upload"} />
            {url ? "Thay logo" : "Tải logo lên"}
          </button>
          {url ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-error hover:bg-error-container/30 disabled:opacity-60"
              disabled={busy !== null}
              type="button"
              onClick={() => void remove()}
            >
              <MaterialIcon className="text-[18px]" name={busy === "remove" ? "progress_activity" : "delete"} />
              Gỡ logo
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className={`text-sm font-semibold ${message.ok ? "text-emerald-700" : "text-error"}`}>{message.text}</p>
      ) : null}
    </section>
  );
}
