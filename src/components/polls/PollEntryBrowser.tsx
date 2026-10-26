"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { ImageLightboxModal } from "@/components/polls/ImageLightboxModal";
import type { PollOption } from "@/lib/data/polls";
import type { PollEntryDetail } from "@/lib/polls/entry-view";

export type PollEntryStatus = { label: string; tone: "selected" | "info" | "muted" } | null;

type Props = {
  pollId: string;
  options: PollOption[];
  showImages: boolean;
  statusFor?: (optionId: string) => PollEntryStatus;
  renderActions?: (option: PollOption) => ReactNode;
};

const PAGE_SIZE = 24;
const SWIPE_MIN_PX = 40;

const STATUS_CLASS: Record<"selected" | "info" | "muted", string> = {
  selected: "bg-primary text-white",
  info: "bg-amber-100 text-amber-900",
  muted: "bg-slate-200 text-slate-700",
};

function entryLabel(opt: PollOption) {
  return `#${opt.orderNum} · ${opt.title}`;
}

export function PollEntryBrowser({ pollId, options, showImages, statusFor, renderActions }: Props) {
  const [currentId, setCurrentId] = useState<string | null>(options[0]?.id ?? null);
  const [details, setDetails] = useState<Record<string, PollEntryDetail>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<{ url: string; title: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const index = options.findIndex((o) => o.id === currentId);
  const current = index >= 0 ? options[index] : null;
  const detail = current ? details[current.id] : undefined;
  const images = showImages ? detail?.images ?? [] : [];

  const scrollToDetail = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById("poll-entry-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }, []);

  const selectEntry = useCallback(
    (id: string, scroll = false) => {
      setCurrentId(id);
      setImageIndex(0);
      setDetailError(null);
      const url = new URL(window.location.href);
      url.searchParams.set("entry", id);
      window.history.replaceState(window.history.state, "", url);
      if (scroll) scrollToDetail();
    },
    [scrollToDetail],
  );

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("entry");
    if (fromUrl && options.some((o) => o.id === fromUrl)) {
      setCurrentId(fromUrl);
      scrollToDetail();
    }
    // Chỉ đọc link ?entry= một lần lúc mở trang.
  }, []);

  useEffect(() => {
    if (options.length > 0 && !options.some((o) => o.id === currentId)) {
      setCurrentId(options[0].id);
      setImageIndex(0);
    }
  }, [options, currentId]);

  useEffect(() => {
    if (!current || details[current.id]) return;
    const controller = new AbortController();
    fetch(`/api/polls/${encodeURIComponent(pollId)}/entries/${encodeURIComponent(current.id)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.entry) throw new Error(data.error || "Không tải được bài thi.");
        setDetails((prev) => ({ ...prev, [data.entry.id]: data.entry as PollEntryDetail }));
      })
      .catch((err) => {
        if (!controller.signal.aborted) setDetailError(err?.message || "Không tải được bài thi.");
      });
    return () => controller.abort();
  }, [current, details, pollId, reloadKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    if (!q) return options;
    return options.filter(
      (o) =>
        String(o.orderNum) === q ||
        o.title.toLowerCase().includes(q) ||
        o.members.some((m) => m.fullName.toLowerCase().includes(q)),
    );
  }, [options, query]);
  const visible = filtered.slice(0, visibleCount);

  if (options.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
        Chương trình chưa có bài thi nào.
      </p>
    );
  }

  const imageSrc = images[Math.min(imageIndex, Math.max(images.length - 1, 0))];
  const members = detail?.members ?? current?.members.map((m) => ({ fullName: m.fullName, employeeCode: null })) ?? [];

  function showImage(next: number) {
    if (images.length === 0) return;
    setImageIndex((next + images.length) % images.length);
  }

  function handleTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  }

  function handleTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t || images.length < 2) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
    showImage(dx < 0 ? imageIndex + 1 : imageIndex - 1);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <ImageLightboxModal imageUrl={zoomed?.url || null} title={zoomed?.title} onClose={() => setZoomed(null)} />

      {/* Chi tiết một bài thi */}
      {current ? (
        <div
          id="poll-entry-detail"
          className="scroll-mt-20 space-y-4 rounded-2xl border-2 border-primary/30 bg-surface-container-lowest p-3 sm:p-5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <button
              aria-label="Bài trước"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant text-[#173A67] hover:bg-primary/10 transition cursor-pointer disabled:opacity-40"
              disabled={index <= 0}
              type="button"
              onClick={() => selectEntry(options[index - 1].id)}
            >
              <MaterialIcon name="chevron_left" />
            </button>
            <select
              aria-label="Chọn bài thi"
              className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-sm font-bold text-[#173A67]"
              value={current.id}
              onChange={(e) => selectEntry(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {entryLabel(o)}
                </option>
              ))}
            </select>
            <button
              aria-label="Bài sau"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant text-[#173A67] hover:bg-primary/10 transition cursor-pointer disabled:opacity-40"
              disabled={index >= options.length - 1}
              type="button"
              onClick={() => selectEntry(options[index + 1].id)}
            >
              <MaterialIcon name="chevron_right" />
            </button>
          </div>

          {showImages ? (
            <div className="space-y-2">
              <div
                className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-surface-container"
                onTouchEnd={handleTouchEnd}
                onTouchStart={handleTouchStart}
              >
                {imageSrc ? (
                  <button
                    className="block h-full w-full cursor-zoom-in"
                    type="button"
                    onClick={() => setZoomed({ url: imageSrc, title: current.title })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={imageSrc}
                      alt={`${current.title} (ảnh ${imageIndex + 1})`}
                      className={`h-full w-full object-contain transition-opacity ${loadedSrc === imageSrc ? "opacity-100" : "opacity-0"}`}
                      decoding="async"
                      src={imageSrc}
                      onError={() => setLoadedSrc(imageSrc)}
                      onLoad={() => setLoadedSrc(imageSrc)}
                    />
                  </button>
                ) : null}
                {!detail && !detailError ? (
                  <div className="absolute inset-0 animate-pulse bg-surface-container-high" />
                ) : imageSrc && loadedSrc !== imageSrc ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <MaterialIcon className="animate-spin text-[28px] text-on-surface-variant" name="progress_activity" />
                  </div>
                ) : detail && images.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-on-surface-variant">
                    Bài thi chưa có ảnh.
                  </div>
                ) : null}

                {images.length > 1 ? (
                  <>
                    <button
                      aria-label="Ảnh trước"
                      className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
                      type="button"
                      onClick={() => showImage(imageIndex - 1)}
                    >
                      <MaterialIcon name="chevron_left" />
                    </button>
                    <button
                      aria-label="Ảnh sau"
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
                      type="button"
                      onClick={() => showImage(imageIndex + 1)}
                    >
                      <MaterialIcon name="chevron_right" />
                    </button>
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                      {imageIndex + 1}/{images.length}
                    </span>
                  </>
                ) : null}
              </div>
              {images.length > 1 ? (
                <div className="flex justify-center gap-2">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Xem ảnh ${i + 1}`}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        i === imageIndex ? "w-6 bg-primary" : "w-2.5 bg-outline-variant"
                      }`}
                      type="button"
                      onClick={() => showImage(i)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2.5">
              <h4 className="text-base sm:text-title-md font-extrabold text-[#173A67] leading-snug">{current.title}</h4>
              <span className="shrink-0 rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-bold text-on-surface-variant">
                #{current.orderNum} · {index + 1}/{options.length}
              </span>
            </div>
            {members.length > 0 ? (
              <p className="text-xs sm:text-sm text-on-surface-variant">
                <span className="font-bold text-[#173A67]">Tác giả: </span>
                {members.map((m) => `${m.fullName}${m.employeeCode ? ` (${m.employeeCode})` : ""}`).join(", ")}
              </p>
            ) : null}
            {detail?.description ? (
              <p className="whitespace-pre-line text-sm text-on-surface-variant leading-relaxed">{detail.description}</p>
            ) : null}
            {detailError ? (
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-error">
                {detailError}
                <button
                  className="rounded-lg border border-error/40 px-2 py-0.5 text-xs font-bold hover:bg-error/10 cursor-pointer"
                  type="button"
                  onClick={() => {
                    setDetailError(null);
                    setReloadKey((k) => k + 1);
                  }}
                >
                  Thử lại
                </button>
              </p>
            ) : null}
          </div>

          {renderActions ? renderActions(current) : null}
        </div>
      ) : null}

      {/* Danh sách bài thi: chỉ chữ, không ảnh */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-extrabold text-[#173A67]">Tất cả bài thi ({options.length})</h4>
        </div>
        {options.length > PAGE_SIZE ? (
          <input
            aria-label="Tìm bài thi"
            className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm"
            placeholder="Tìm theo số, tên bài hoặc tác giả"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        ) : null}
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {visible.map((o) => {
            const status = statusFor?.(o.id) ?? null;
            const active = o.id === currentId;
            return (
              <li key={o.id}>
                <button
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition cursor-pointer ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-outline-variant bg-surface-container-lowest hover:border-primary/50"
                  }`}
                  type="button"
                  onClick={() => selectEntry(o.id, true)}
                >
                  <span
                    className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-black ${
                      active ? "bg-primary text-white" : "bg-surface-container-high text-[#173A67]"
                    }`}
                  >
                    {o.orderNum}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#173A67]">{o.title}</span>
                    {o.members.length > 0 ? (
                      <span className="block truncate text-[11px] text-on-surface-variant">
                        {o.members.map((m) => m.fullName).join(", ")}
                      </span>
                    ) : null}
                  </span>
                  {status ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[status.tone]}`}>
                      {status.label}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-on-surface-variant">Không có bài thi phù hợp.</p>
        ) : null}
        {filtered.length > visibleCount ? (
          <button
            className="w-full rounded-xl border border-outline-variant py-2 text-sm font-bold text-primary hover:bg-primary/5 cursor-pointer"
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          >
            Xem thêm {Math.min(PAGE_SIZE, filtered.length - visibleCount)} bài
          </button>
        ) : null}
      </div>
    </div>
  );
}
