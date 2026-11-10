import { Fragment } from "react";
import Link from "next/link";
import { POST_INLINE_IMAGE_PATTERN, isAllowedPostImageUrl } from "@/lib/post-images";

type PostContentProps = {
  content: string;
  className?: string;
};

const POST_INLINE_PATTERN = /(\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|\*\*([^\n]+?)\*\*)/g;

function renderText(text: string, keyPrefix: string, nodes: React.ReactNode[]) {
  let lastIndex = 0;

  for (const match of text.matchAll(POST_INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(<Fragment key={`${keyPrefix}t${lastIndex}`}>{text.slice(lastIndex, index)}</Fragment>);
    }

    if (match[2] && match[3]) {
      const rawLabel = match[2];
      const cleanLabel = rawLabel.replace(/\*\*([^\n]+?)\*\*/g, "$1").trim();
      const url = match[3].trim();
      const isButton = /đăng k[ýí]|tham gia|xem thêm|bấm vào|tại đây/i.test(cleanLabel);
      const isInternal = url.startsWith("/") || url.startsWith("#");

      if (isButton) {
        const buttonEl = (
          <span className="my-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm sm:text-base font-bold text-white shadow-sm transition hover:bg-dusty-dark hover:shadow active:scale-[0.98] cursor-pointer">
            <span>{cleanLabel}</span>
            <span aria-hidden="true">&rarr;</span>
          </span>
        );
        nodes.push(
          isInternal ? (
            <Link key={`${keyPrefix}l${index}`} href={url} prefetch={false} className="inline-block no-underline">
              {buttonEl}
            </Link>
          ) : (
            <a
              key={`${keyPrefix}l${index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block no-underline"
            >
              {buttonEl}
            </a>
          ),
        );
      } else {
        nodes.push(
          isInternal ? (
            <Link
              key={`${keyPrefix}l${index}`}
              href={url}
              prefetch={false}
              className="font-semibold text-primary underline underline-offset-2 hover:text-dusty-dark transition"
            >
              {cleanLabel}
            </Link>
          ) : (
            <a
              key={`${keyPrefix}l${index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-2 hover:text-dusty-dark transition"
            >
              {cleanLabel}
            </a>
          ),
        );
      }
    } else if (match[4]) {
      nodes.push(
        <strong key={`${keyPrefix}b${index}`} className="font-bold">
          {match[4]}
        </strong>,
      );
    }

    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}t${lastIndex}`}>{text.slice(lastIndex)}</Fragment>);
  }
}

export function PostContent({ content, className }: PostContentProps) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(POST_INLINE_IMAGE_PATTERN)) {
    const url = match[2];
    if (!isAllowedPostImageUrl(url)) continue;

    const index = match.index ?? 0;
    // Ảnh hiển thị dạng khối: bỏ một lần xuống dòng sát trước/sau để không tạo khoảng trống thừa.
    const before = content.slice(lastIndex, index).replace(/\r?\n$/, "");
    if (before) renderText(before, `s${lastIndex}`, nodes);
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`img${index}`}
        alt={match[1].trim() || "Ảnh trong bài viết"}
        className="my-3 block h-auto max-w-full rounded-xl border border-dusty-border/60 bg-slate-50"
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={url}
      />,
    );
    lastIndex = index + match[0].length;
    if (content.startsWith("\r\n", lastIndex)) lastIndex += 2;
    else if (content.startsWith("\n", lastIndex)) lastIndex += 1;
  }
  if (lastIndex < content.length) renderText(content.slice(lastIndex), `s${lastIndex}`, nodes);

  return <div className={className}>{nodes}</div>;
}
