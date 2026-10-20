import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { POPUP_TONE_META, type PopupContent } from "@/lib/popups";

type Props = {
  popup: PopupContent;
  onClose?: () => void;
  onOpenLink?: () => void;
  /** Đếm "1/3" khi có nhiều popup cùng lúc. */
  position?: { index: number; total: number };
};

export function PopupCard({ popup, onClose, onOpenLink, position }: Props) {
  const tone = POPUP_TONE_META[popup.tone];
  const hasLink = Boolean(popup.linkUrl);

  return (
    <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className={`relative shrink-0 bg-gradient-to-br ${tone.header} px-6 py-5 text-center text-white`}>
        {onClose ? (
          <button
            aria-label="Đóng"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            type="button"
            onClick={onClose}
          >
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        ) : null}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
          <MaterialIcon className={`text-[28px] ${tone.iconColor}`} name={tone.icon} />
        </div>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-white/80">
          {tone.label}
          {position && position.total > 1 ? ` · ${position.index}/${position.total}` : ""}
        </p>
        <h2 className="mt-1 break-words text-lg font-extrabold leading-snug sm:text-xl">
          {popup.title || "Tiêu đề popup"}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-on-surface sm:text-[15px]">
          {popup.body || "Nội dung ngắn hiển thị ở đây."}
        </p>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-dusty-border/70 px-6 py-4">
        <button
          className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
            hasLink
              ? "flex-1 border border-dusty-border text-on-surface-variant"
              : `flex-1 ${tone.button} text-white shadow-sm`
          }`}
          type="button"
          onClick={onClose}
        >
          {hasLink ? "Đóng" : "Đã hiểu"}
        </button>
        {hasLink ? (
          <button
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl ${tone.button} px-4 py-2.5 text-sm font-extrabold text-white shadow-sm`}
            type="button"
            onClick={onOpenLink}
          >
            <span className="truncate">{popup.linkLabel || "Xem chi tiết"}</span>
            <MaterialIcon className="text-[18px]" name="arrow_forward" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
