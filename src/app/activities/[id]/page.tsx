import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getSessionUserId } from "@/lib/auth/session";
import { getActivityById } from "@/lib/data/activities";
import { ActivityDetailActionButtons } from "@/components/activities/ActivityDetailActionButtons";

export const revalidate = 10;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ActivityDetailPage({ params }: Props) {
  const { id } = await params;

  let currentUserId: string | undefined;
  try {
    currentUserId = (await getSessionUserId()) ?? undefined;
  } catch {
    // ignore
  }

  const activity = await getActivityById(id, currentUserId);
  if (!activity) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Breadcrumb nav */}
      <nav className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
        <Link className="hover:text-primary transition" href="/">
          Trang chủ
        </Link>
        <MaterialIcon className="text-[14px]" name="chevron_right" />
        <Link className="hover:text-primary transition" href="/#nhiem-vu">
          Hoạt động nổi bật
        </Link>
        <MaterialIcon className="text-[14px]" name="chevron_right" />
        <span className="line-clamp-1 text-on-surface font-medium">{activity.title}</span>
      </nav>

      {/* Main Activity Article */}
      <article className="overflow-hidden rounded-3xl border border-dusty-border/80 bg-surface-container-lowest shadow-sm">
        {/* Cover Image */}
        {activity.imageUrl ? (
          <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-dusty-light">
            <Image
              src={activity.imageUrl}
              alt={activity.imageAlt || activity.title}
              fill
              unoptimized
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs sm:text-sm font-bold text-white shadow-sm">
                <MaterialIcon className="text-[16px]" name="stars" />
                +{activity.points} điểm thi đua
              </span>
              {activity.isRegistrationOpen ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs sm:text-sm font-bold text-white shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  Đang mở đăng ký
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs sm:text-sm font-bold text-white shadow-sm">
                  <MaterialIcon className="text-[16px]" name="lock" />
                  Đã dừng đăng ký
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* Article Header & Info */}
        <div className="p-5 sm:p-8 space-y-6">
          <div className="space-y-3">
            {!activity.imageUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs sm:text-sm font-bold text-white">
                  <MaterialIcon className="text-[16px]" name="stars" />
                  +{activity.points} điểm thi đua
                </span>
                {activity.isRegistrationOpen ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs sm:text-sm font-bold text-white">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    Đang mở đăng ký
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs sm:text-sm font-bold text-white">
                    <MaterialIcon className="text-[16px]" name="lock" />
                    Đã dừng đăng ký
                  </span>
                )}
              </div>
            ) : null}

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-on-surface leading-tight">
              {activity.title}
            </h1>

            {/* Event Meta: Date, Location, Participants */}
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-on-surface-variant border-y border-dusty-border/70 py-3">
              {activity.dateLabel ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <MaterialIcon className="text-[18px] text-primary" name="calendar_month" />
                  Thời gian: <strong className="text-on-surface">{activity.dateLabel}</strong>
                </span>
              ) : null}

              {activity.location ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <MaterialIcon className="text-[18px] text-primary" name="location_on" />
                  Địa điểm: <strong className="text-on-surface">{activity.location}</strong>
                </span>
              ) : null}

              <span className="inline-flex items-center gap-1.5 font-medium">
                <MaterialIcon className="text-[18px] text-primary" name="groups" />
                Đã đăng ký: <strong className="text-primary">{activity.participantCount} đoàn viên</strong>
              </span>
            </div>
          </div>

          {/* Activity Description */}
          {activity.description ? (
            <div className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-on-surface bg-surface-container-low/40 p-4 sm:p-6 rounded-2xl border border-dusty-border/60">
              {activity.description}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant italic">
              Hoạt động phong trào Công đoàn cơ sở CDILV. Toàn thể đoàn viên và người lao động tích cực tham gia để rèn luyện sức khỏe, gắn kết tập thể và tích lũy điểm thi đua!
            </p>
          )}

          {/* Registration Action Buttons */}
          <div className="border-t border-dusty-border/70 pt-5">
            <ActivityDetailActionButtons
              activityId={activity.id}
              activityTitle={activity.title}
              initialIsRegistered={activity.isRegistered ?? false}
              initialIsRegistrationOpen={activity.isRegistrationOpen}
            />
          </div>
        </div>
      </article>

      {/* PARTICIPANTS LIST SECTION */}
      <section className="space-y-4 rounded-3xl border border-dusty-border/80 bg-surface-container-lowest p-5 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dusty-border/70 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MaterialIcon className="text-[22px]" name="groups" />
            </div>
            <div>
              <h2 className="text-title-lg sm:text-headline-sm font-bold text-on-surface">
                Danh sách đoàn viên đăng ký tham gia
              </h2>
              <p className="text-body-xs sm:text-body-sm text-on-surface-variant">
                Dựa trên danh sách các đoàn viên đã bấm đăng ký tham gia hoạt động
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-dusty-light px-3.5 py-1 text-label-xs sm:text-label-sm font-bold text-primary">
            <MaterialIcon className="text-[16px]" name="how_to_reg" />
            {activity.participantCount} đoàn viên
          </span>
        </div>

        {/* Participants table or empty state */}
        {activity.participants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dusty-border p-8 text-center">
            <MaterialIcon
              className="mx-auto mb-2 text-[40px] text-on-surface-variant/40"
              name="person_add_alt"
            />
            <p className="text-body-sm sm:text-body-md font-semibold text-on-surface">
              Chưa có đoàn viên nào đăng ký tham gia
            </p>
            <p className="mt-1 text-xs sm:text-body-sm text-on-surface-variant">
              Hãy bấm nút <strong>&quot;Đăng ký tham gia ngay&quot;</strong> ở trên để là người đầu tiên tham gia hoạt động này!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-dusty-border bg-dusty-light/50 text-on-surface-variant font-bold">
                  <th className="py-3 px-3 sm:px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-3 sm:px-4">Họ và tên đoàn viên</th>
                  <th className="py-3 px-3 sm:px-4 hidden sm:table-cell">Mã nhân viên</th>
                  <th className="py-3 px-3 sm:px-4 hidden md:table-cell">Phòng ban / Đơn vị</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Thời gian đăng ký</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dusty-border/60">
                {activity.participants.map((participant, index) => {
                  const isMe = currentUserId === participant.userId;
                  const initial = (participant.fullName || "Đ").slice(0, 1).toUpperCase();

                  return (
                    <tr
                      key={participant.id}
                      className={`transition-colors hover:bg-dusty-light/40 ${
                        isMe ? "bg-primary/[0.04] font-semibold" : ""
                      }`}
                    >
                      <td className="py-3 px-3 sm:px-4 text-center font-bold text-on-surface-variant">
                        {index + 1}
                      </td>

                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dusty-border bg-dusty-light font-bold text-primary text-xs">
                            {participant.avatarUrl ? (
                              <img
                                src={participant.avatarUrl}
                                alt={participant.fullName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-on-surface text-xs sm:text-sm">
                                {participant.fullName}
                              </span>
                              {isMe && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                                  Bạn
                                </span>
                              )}
                            </div>
                            {/* Mobile only subline */}
                            <p className="text-[11px] text-on-surface-variant sm:hidden">
                              {participant.department || "Đoàn viên"}
                              {participant.employeeCode ? ` · ${participant.employeeCode}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 sm:px-4 hidden sm:table-cell text-on-surface-variant font-mono">
                        {participant.employeeCode || "—"}
                      </td>

                      <td className="py-3 px-3 sm:px-4 hidden md:table-cell text-on-surface-variant">
                        {participant.department || "—"}
                      </td>

                      <td className="py-3 px-3 sm:px-4 text-right text-on-surface-variant whitespace-nowrap">
                        <span title={new Date(participant.registeredAt).toLocaleString("vi-VN")}>
                          {participant.timeAgo}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl border border-dusty-border bg-white px-4 py-2 text-label-md font-semibold text-primary hover:bg-dusty-light/50 transition"
        >
          <MaterialIcon className="text-[18px]" name="arrow_back" />
          <span>Về Trang chủ</span>
        </Link>

        <Link
          href="/posts"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-label-md font-bold text-white hover:bg-dusty-dark transition"
        >
          <span>Xem tất cả bài viết</span>
          <MaterialIcon className="text-[18px]" name="arrow_forward" />
        </Link>
      </div>
    </div>
  );
}
