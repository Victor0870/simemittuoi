"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { PostEditButton } from "@/components/posts/PostEditButton";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { PostDetail } from "@/lib/data/posts";
import { GUIDE_POST_CATEGORY } from "@/lib/post-categories";
import { formatScheduleLabel } from "@/lib/post-schedule";

type PostRow = PostDetail;

function statusLabel(p: PostRow): string {
  if (!p.isActive) return "Inactive";
  return p.isScheduled ? "Hẹn giờ" : "Active";
}

type AdminPostsManagerProps = {
  posts: PostRow[];
  heading: string;
  intro: ReactNode;
  listLabel: string;
  createLabel: string;
  emptyText: string;
  /** Tag mặc định cho bài mới (vd. chuyên mục Hướng dẫn sử dụng). */
  defaultTag?: string;
  showTag?: boolean;
  /** Bài mở sẵn form sửa (?edit=). */
  editId?: string | null;
  /** Mở sẵn form đăng bài mới (?new=1). */
  openCreate?: boolean;
};

/** Bảng bài viết (gồm cả bài Inactive / hẹn giờ) cho người quản lý bài viết: xem trước, sửa, đăng bài mới. */
export function AdminPostsManager({
  posts,
  heading,
  intro,
  listLabel,
  createLabel,
  emptyText,
  defaultTag,
  showTag = false,
  editId = null,
  openCreate = false,
}: AdminPostsManagerProps) {
  const { canOpenAdmin } = useAuth();
  const activeCount = posts.filter((p) => p.isActive && !p.isScheduled).length;

  const columns: DataTableColumn<PostRow>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      className: "min-w-[14rem] max-w-[26rem] font-bold text-[#173A67]",
      render: (p) => (
        <div className="space-y-0.5">
          <Link
            prefetch={false}
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
    ...(showTag
      ? [
          {
            key: "tag",
            header: "Chuyên mục",
            type: "enum",
            accessor: (p: PostRow) => p.tag,
            className: "whitespace-nowrap text-xs font-semibold text-on-surface-variant",
          } satisfies DataTableColumn<PostRow>,
        ]
      : []),
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
            prefetch={false}
            aria-label="Xem trước"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white text-[#173A67] shadow-2xs transition hover:bg-surface-container-high"
            href={`/posts/${p.id}/preview`}
            title="Xem trước"
          >
            <MaterialIcon className="text-[18px]" name="visibility" />
          </Link>
          {p.isContest && canOpenAdmin(`/admin/content/posts/submissions/${p.id}`) ? (
            <Link
              prefetch={false}
              aria-label="Tác phẩm dự thi"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white text-[#173A67] shadow-2xs transition hover:bg-surface-container-high"
              href={`/admin/content/posts/submissions/${p.id}`}
              title="Tác phẩm dự thi"
            >
              <MaterialIcon className="text-[18px]" name="palette" />
            </Link>
          ) : null}
          <PostEditButton autoOpen={p.id === editId} compact post={p} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">{heading}</h1>
          <p className="text-body-md text-[#27496D]">{intro}</p>
        </div>
        <PostEditButton autoOpen={openCreate} createLabel={createLabel} defaultTag={defaultTag} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-title-lg font-bold text-[#173A67]">
          {listLabel} ({posts.length})
        </h2>
        <span className="text-xs font-medium text-on-surface-variant">
          Đang hiển thị công khai: <strong>{activeCount}</strong>
        </span>
      </div>

      <DataTable
        columns={columns}
        defaultPageSize={10}
        density="compact"
        emptyText={emptyText}
        maxHeightClass="max-h-[calc(100dvh-300px)] min-h-[240px]"
        rowKey={(p) => p.id}
        rows={posts}
      />
    </div>
  );
}

/** Bảng bài hướng dẫn sử dụng (gồm cả bài Inactive / hẹn giờ) cho người quản lý bài viết. */
export function AdminGuidePostsManager({
  posts,
  editId,
  openCreate,
}: {
  posts: PostRow[];
  editId?: string | null;
  openCreate?: boolean;
}) {
  return (
    <AdminPostsManager
      createLabel="Thêm bài hướng dẫn"
      defaultTag={GUIDE_POST_CATEGORY.tag}
      editId={editId}
      emptyText="Chưa có bài hướng dẫn nào. Bấm “Thêm bài hướng dẫn” để tạo bài đầu tiên."
      heading={GUIDE_POST_CATEGORY.tag}
      intro={
        <>
          Bài viết thuộc chuyên mục Hướng dẫn sử dụng (gồm cả bài Inactive). Bài Active hiện trên trang{" "}
          <Link prefetch={false} className="font-semibold text-primary hover:underline" href={GUIDE_POST_CATEGORY.href}>
            {GUIDE_POST_CATEGORY.href}
          </Link>
          .
        </>
      }
      listLabel="Danh sách bài hướng dẫn"
      openCreate={openCreate}
      posts={posts}
    />
  );
}
