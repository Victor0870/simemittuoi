/** Khóa hub = đoạn cuối đường dẫn /admin/<khóa>; dùng cho tham số ?from= khi ô hub mở trang ngoài khung quản trị. */
export const HUB_KEYS = ["members-hub", "competition", "content", "administration", "finance", "system"] as const;

export type HubKey = (typeof HUB_KEYS)[number];

export function isHubKey(value: unknown): value is HubKey {
  return typeof value === "string" && (HUB_KEYS as readonly string[]).includes(value);
}

/** Thêm from=<hub> cho link ra ngoài /admin, /office (giữ query sẵn có, đặt trước #hash). */
export function withHubFrom(href: string, hubKey: HubKey | undefined): string {
  if (!hubKey || /^\/(admin|office)(\/|$|\?|#)/.test(href)) return href;
  const hashIndex = href.indexOf("#");
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  return `${base}${base.includes("?") ? "&" : "?"}from=${hubKey}${hash}`;
}
