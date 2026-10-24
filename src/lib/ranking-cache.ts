/** Bảng xếp hạng thi đua và kết quả bình chọn đọc từ cache, làm mới tối đa 15 phút/lần. */
export const RANKING_REVALIDATE_SECONDS = 900;

export const RANKING_UPDATE_NOTE = "Cập nhật mỗi 15 phút";

export const LEADERBOARD_CACHE_TAG = "leaderboard-rows";

export function pollResultsCacheTag(pollId: string) {
  return `poll-results:${pollId}`;
}
