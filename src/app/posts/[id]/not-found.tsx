import Link from "next/link";

export default function PostNotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dusty-border bg-white px-6 py-12 text-center shadow-sm">
      <h1 className="text-headline-md font-bold text-on-surface">
        Không tìm thấy bài viết
      </h1>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Bài viết có thể đã bị gỡ hoặc đường dẫn không còn hợp lệ.
      </p>
      <Link
        className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-white hover:bg-dusty-dark"
        href="/posts"
      >
        Về danh sách bài viết
      </Link>
    </div>
  );
}
