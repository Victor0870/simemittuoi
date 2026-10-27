import Link from "next/link";
import { AnnouncementCard } from "@/components/home/AnnouncementCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { Announcement } from "@/lib/mock-data";

type NewsSectionProps = {
  posts: Announcement[];
};

export function NewsSection({ posts }: NewsSectionProps) {
  if (posts.length === 0) return null;

  return (
    <section className="space-y-4" id="tin-tuc">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-dusty-light p-1.5 text-primary">
            <MaterialIcon className="text-[22px]" name="newspaper" />
          </div>
          <div>
            <h2 className="text-headline-md font-bold text-on-surface">
              Tin tức &amp; Hoạt động
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              Các phong trào, sự kiện và tin tức công đoàn mới nhất
            </p>
          </div>
        </div>
        <Link prefetch={false}
          className="flex items-center gap-1 text-label-md font-semibold text-primary transition-colors hover:text-dusty-dark"
          href="/posts"
        >
          <span>Xem tất cả bài viết</span>
          <MaterialIcon className="text-[16px]" name="arrow_forward" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
        {posts.map((post) => (
          <AnnouncementCard key={post.id} announcement={post} />
        ))}
      </div>
    </section>
  );
}
