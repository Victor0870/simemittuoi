/** Lần hiện tab và sự kiện focus thường đến gần nhau: chỉ chạy một lần trong khoảng này. */
const RESUME_DEDUPE_MS = 2_000;

/**
 * Chạy `run` ngay rồi lặp lại mỗi `intervalMs`, tạm dừng khi tab bị ẩn.
 * Khi tab hiện lại thì chạy ngay một lần rồi lặp tiếp. Trả về hàm dọn dẹp cho useEffect.
 */
export function startVisiblePolling(
  run: () => void,
  intervalMs: number,
  options: { refetchOnFocus?: boolean } = {},
): () => void {
  let timer: number | null = null;
  let lastRun = 0;

  const tick = () => {
    lastRun = Date.now();
    run();
  };
  const start = () => {
    if (timer === null) timer = window.setInterval(tick, intervalMs);
  };
  const stop = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      stop();
      return;
    }
    if (Date.now() - lastRun > RESUME_DEDUPE_MS) tick();
    start();
  };
  const onFocus = () => {
    if (document.visibilityState !== "hidden" && Date.now() - lastRun > RESUME_DEDUPE_MS) tick();
  };

  if (document.visibilityState !== "hidden") {
    tick();
    start();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  if (options.refetchOnFocus) window.addEventListener("focus", onFocus);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (options.refetchOnFocus) window.removeEventListener("focus", onFocus);
  };
}
