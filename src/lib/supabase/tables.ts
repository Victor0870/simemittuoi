/**
 * Tên bảng / RPC / Storage khi CDILV dùng chung project Supabase với BizMate.
 * Giống cách BizMate tách POS (shops, products…) và web hóa đơn (invoice_*, hkd_*):
 * cùng schema public, khác tên bảng — không dùng chung public.profiles của POS.
 */
export const CDILV_TABLE = {
  profiles: "cdilv_profiles",
  posts: "cdilv_posts",
  activities: "cdilv_activities",
  scoreEvents: "cdilv_score_events",
  employeeWhitelist: "cdilv_employee_whitelist",
  employeeScoreEvents: "cdilv_employee_score_events",
  leaderboardCache: "cdilv_leaderboard_cache",
  leaderboard: "cdilv_leaderboard",
  polls: "cdilv_polls",
  pollOptions: "cdilv_poll_options",
  pollOptionMembers: "cdilv_poll_option_members",
  pollVotes: "cdilv_poll_votes",
  pollPredictions: "cdilv_poll_predictions",
  postComments: "cdilv_post_comments",
  activityRegistrations: "cdilv_activity_registrations",
  feedbacks: "cdilv_feedbacks",
  commentReactions: "cdilv_comment_reactions",
} as const;

export const CDILV_RPC = {
  validateEmployeeForSignup: "cdilv_validate_employee_for_signup",
  transferEmployeeScores: "cdilv_transfer_employee_scores",
  updateMyAvatar: "cdilv_update_my_avatar",
  refreshLeaderboardCache: "cdilv_refresh_leaderboard_cache",
} as const;

/** Bucket avatar riêng — không dùng chung bucket avatars (nếu BizMate có). */
export const CDILV_STORAGE = {
  avatars: "cdilv-avatars",
} as const;

/** Gắn vào auth.signUp options.data để trigger BizMate bỏ qua user CDILV. */
export const CDILV_AUTH_APP = "cdilv" as const;
