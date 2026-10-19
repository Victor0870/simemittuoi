"use client";

import { useEffect, useId, useRef, useState } from "react";
import QRCode from "qrcode";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { BRAND } from "@/lib/brand";

type Props = {
  pollId: string;
  pollTitle: string;
  label?: string;
  heading?: string;
  description?: string;
  downloadName?: string;
  buttonClassName?: string;
  loadUrl?: () => Promise<string>;
};

function voteUrlFor(pollId: string) {
  const path = `/polls/${pollId}#binh-chon`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return `${BRAND.siteUrl}${path}`;
}

export function PollQrButton({
  pollId,
  pollTitle,
  label = "Mã QR",
  heading = "Mã QR bình chọn",
  description = "Quét mã để mở thẳng trang bình chọn này.",
  downloadName,
  buttonClassName = "inline-flex items-center gap-1.5 rounded-xl border border-[#173A67] bg-white px-3 py-1.5 text-xs sm:text-label-md font-bold text-[#173A67] shadow-xs transition hover:bg-[#173A67] hover:text-white cursor-pointer",
  loadUrl,
}: Props) {
  const titleId = useId();
  const loadUrlRef = useRef(loadUrl);
  loadUrlRef.current = loadUrl;
  const [open, setOpen] = useState(false);
  const [voteUrl, setVoteUrl] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setVoteUrl("");
    setCopied(false);
    setError(null);
    setDataUrl(null);

    (async () => {
      try {
        const url = loadUrlRef.current ? await loadUrlRef.current() : voteUrlFor(pollId);
        if (cancelled) return;
        setVoteUrl(url);
        const image = await QRCode.toDataURL(url, {
          width: 640,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setDataUrl(image);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tạo được mã QR. Vui lòng thử lại.");
        }
      }
    })();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pollId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(voteUrl);
      setCopied(true);
    } catch {
      setError("Không sao chép được link. Hãy chọn và sao chép thủ công.");
    }
  }

  function downloadQr() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = downloadName || `qr-binh-chon-${pollId}.png`;
    link.click();
  }

  return (
    <>
      <button
        className={buttonClassName}
        type="button"
        onClick={() => setOpen(true)}
      >
        <MaterialIcon className="text-[18px]" name="qr_code_2" />
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-title-md font-extrabold text-[#173A67]">
                  {heading}
                </h2>
                <p className="mt-1 text-body-sm text-on-surface-variant line-clamp-2">{pollTitle}</p>
              </div>
              <button
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                type="button"
                aria-label="Đóng"
                onClick={() => setOpen(false)}
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="mt-4 flex min-h-64 items-center justify-center rounded-2xl border border-outline-variant bg-white p-4">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`Mã QR vào trang bình chọn ${pollTitle}`}
                  className="h-64 w-64"
                  src={dataUrl}
                />
              ) : error ? (
                <p className="text-body-sm font-semibold text-error">{error}</p>
              ) : (
                <p className="text-body-sm text-on-surface-variant">Đang tạo mã QR...</p>
              )}
            </div>

            <p className="mt-3 text-label-sm leading-relaxed text-on-surface-variant">
              {description}
            </p>

            {voteUrl ? (
              <p className="mt-2 break-all rounded-xl bg-surface-container-low px-3 py-2 text-label-sm font-semibold text-[#173A67]">
                {voteUrl}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#173A67] px-3 py-2 text-label-md font-bold text-white hover:bg-[#27496D] cursor-pointer disabled:opacity-50"
                type="button"
                disabled={!voteUrl}
                onClick={copyLink}
              >
                <MaterialIcon className="text-[18px]" name={copied ? "check" : "content_copy"} />
                {copied ? "Đã sao chép" : "Sao chép link"}
              </button>
              <button
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#173A67] px-3 py-2 text-label-md font-bold text-[#173A67] hover:bg-[#173A67] hover:text-white cursor-pointer disabled:opacity-50"
                type="button"
                disabled={!dataUrl}
                onClick={downloadQr}
              >
                <MaterialIcon className="text-[18px]" name="download" />
                Tải ảnh QR
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
