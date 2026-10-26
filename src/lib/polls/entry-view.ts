import type { PollDetail, PollOption } from "@/lib/data/polls";

/** Dữ liệu công khai, giống nhau cho mọi người: CDN giữ 60 giây, trình duyệt 15 giây. */
export const PUBLIC_ENTRY_CACHE_CONTROL = "public, max-age=15, s-maxage=60, stale-while-revalidate=300";

/** Dữ liệu riêng từng người (điểm, phiếu, bài của tôi): không cho cache dùng chung. */
export const PRIVATE_NO_STORE = "private, no-store";

export type PollEntryListItem = {
  id: string;
  orderNum: number;
  title: string;
  members: string[];
  isActive: boolean;
};

export type PollEntryDetail = {
  id: string;
  pollId: string;
  orderNum: number;
  title: string;
  description: string | null;
  members: Array<{ fullName: string; employeeCode: string | null }>;
  images: string[];
};

export function toEntryListItem(opt: PollOption): PollEntryListItem {
  return {
    id: opt.id,
    orderNum: opt.orderNum,
    title: opt.title,
    members: opt.members.map((m) => m.fullName).filter(Boolean),
    isActive: opt.isActive !== false,
  };
}

export function toEntryDetail(opt: PollOption): PollEntryDetail {
  return {
    id: opt.id,
    pollId: opt.pollId,
    orderNum: opt.orderNum,
    title: opt.title,
    description: opt.description,
    members: opt.members.map((m) => ({ fullName: m.fullName, employeeCode: m.employeeCode })),
    images: opt.imageUrls,
  };
}

/**
 * Dữ liệu gửi xuống trang công khai: bỏ mô tả, mã nhân viên của tác giả và chỉ giữ ảnh đầu (bục vinh danh dùng).
 * Mô tả và toàn bộ ảnh của một bài lấy riêng qua API chi tiết khi người xem mở bài đó.
 */
export function toPublicPollView(poll: PollDetail): PollDetail {
  return {
    ...poll,
    options: poll.options.map((opt) => ({
      ...opt,
      description: null,
      imageUrls: opt.imageUrls.slice(0, 1),
      members: opt.members.map((m) => ({ id: m.id, fullName: m.fullName, employeeCode: null })),
    })),
  };
}
