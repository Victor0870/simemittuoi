"use client";

import { useEffect } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type Props = {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
};

export function ImageLightboxModal({ imageUrl, title, onClose }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (imageUrl) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs transition-opacity animate-in fade-in"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] max-w-[94vw] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            aria-label="Đóng ảnh"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 cursor-pointer shadow-md"
            type="button"
            onClick={onClose}
          >
            <MaterialIcon className="text-[24px]" name="close" />
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={title || "Ảnh phóng to"}
          className="max-h-[82vh] w-auto max-w-full object-contain"
          src={imageUrl}
        />

        {title ? (
          <div className="bg-surface-container-lowest px-6 py-3 border-t border-outline-variant">
            <p className="text-center text-label-md font-bold text-[#173A67]">{title}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
