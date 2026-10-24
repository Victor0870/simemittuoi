"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { PostEditButton } from "@/components/posts/PostEditButton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PostDetail } from "@/lib/data/posts";
import { GUIDE_POST_CATEGORY } from "@/lib/post-categories";
import { formatScheduleLabel } from "@/lib/post-schedule";

type GuideRow = PostDetail;

function statusLabel(p: GuideRow): string {
  if (!p.isActive) return "Inactive";
  return p.isScheduled ? "Hẹn giờ" : "Active";
}

/** Bảng bài hướng dẫn sử dụng (gồm cả bài Inactive / hẹn giờ) cho người quản lý bài viết. */
export function AdminGuidePostsManager({ posts }: { posts: GuideRow[] }) {
  const activeCount = posts.filter((p) => p.isActive && !p.isScheduled).length;

  const columns: DataTableColumn<GuideRow>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      className: "min-w-[14rem] max-w-[26rem] font-bold text-[#173A67]",
      render: (p) => (
        <div className="space-y-0.5">
          <Link
            className="line-clamp-2 break-words hover:underline"
            href={`/posts/${p.id}/preview`}
            title={p.title}
          >
            {p.title}
          </Link>
          {p.excerpt ? (
            <p className="line-clamp-1 text-xs font-normal text-on-surface-variant" title={p.excerpt}>
              {p.excerpt}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      type: "enum",
      accessor: statusLabel,
      className: "whitespace-nowrap",
      render: (p) => {
        const label = statusLabel(p);
        const chip =
          label === "Active"
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : label === "Hẹn giờ"
              ? "border-sky-300 bg-sky-50 text-sky-900"
              : "border-slate-300 bg-slate-100 text-slate-600";
        const dot = label === "Active" ? "bg-emerald-500" : label === "Hẹn giờ" ? "bg-sky-500" : "bg-slate-400";
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${chip}`}
            title={label === "Hẹn giờ" ? `Hẹn đăng ${formatScheduleLabel(p.publishedAt)}` : undefined}
          >
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {label}
          </span>
        );
      },
    },
    {
      key: "publishedAt",
      header: "Ngày đăng",
      type: "date",
      className: "whitespace-nowrap text-xs text-on-surface-variant",
      render: (p) => {
        const d = new Date(p.publishedAt);
        const tz = { timeZone: "Asia/Ho_Chi_Minh" } as const;
        return `${d.toLocaleDateString("vi-VN", { ...tz, day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("vi-VN", { ...tz, hour: "2-digit", minute: "2-digit" })}`;
      },
    },
    {
      key: "actions",
      header: "Thao tác",
      filterable: false,
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (p) => (
        <div className="inline-flex items-center justify-end gap-1">
          <Link
            aria-label="Xem trước"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white text-[#173A67] shadow-2xs transition hover:bg-surface-container-high"
            href={`/posts/${p.id}/preview`}
            title="Xem trước"
          >
            <MaterialIcon className="text-[18px]" name="visibility" />
          </Link>
          <PostEditButton compact post={p} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">{GUIDE_POST_CATEGORY.tag}</h1>
          <p className="text-body-md text-[#27496D]">
            Bài viết thuộc chuyên mục Hướng dẫn sử dụng (gồm cả bài Inactive). Bài Active hiện trên trang{" "}
            <Link className="font-semibold text-primary hover:underline" href={GUIDE_POST_CATEGORY.href}>
              {GUIDE_POST_CATEGORY.href}
            </Link>
            .
          </p>
        </div>
        <PostEditButton createLabel="Thêm bài hướng dẫn" defaultTag={GUIDE_POST_CATEGORY.tag} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-title-lg font-bold text-[#173A67]">Danh sách bài hướng dẫn ({posts.length})</h2>
        <span className="text-xs font-medium text-on-surface-variant">
          Đang hiển thị công khai: <strong>{activeCount}</strong>
        </span>
      </div>

      <DataTable
        columns={columns}
        defaultPageSize={10}
        density="compact"
        emptyText="Chưa có bài hướng dẫn nào. Bấm “Thêm bài hướng dẫn” để tạo bài đầu tiên."
        maxHeightClass="max-h-[calc(100dvh-300px)] min-h-[240px]"
        rowKey={(p) => p.id}
        rows={posts}
      />
    </div>
  );
}
