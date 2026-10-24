import { Fragment } from "react";
import { POST_BOLD_PATTERN } from "@/lib/post-format";
import { POST_INLINE_IMAGE_PATTERN, isAllowedPostImageUrl } from "@/lib/post-images";

type PostContentProps = {
  content: string;
  className?: string;
};

function renderText(text: string, keyPrefix: string, nodes: React.ReactNode[]) {
  let lastIndex = 0;

  for (const match of text.matchAll(POST_BOLD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(<Fragment key={`${keyPrefix}t${lastIndex}`}>{text.slice(lastIndex, index)}</Fragment>);
    }
    nodes.push(
      <strong key={`${keyPrefix}b${index}`} className="font-bold">
        {match[1]}
      </strong>,
    );
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
