import { Fragment } from "react";
import { POST_BOLD_PATTERN } from "@/lib/post-format";

type PostContentProps = {
  content: string;
  className?: string;
};

export function PostContent({ content, className }: PostContentProps) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(POST_BOLD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(<Fragment key={`t${lastIndex}`}>{content.slice(lastIndex, index)}</Fragment>);
    }
    nodes.push(
      <strong key={`b${index}`} className="font-bold">
        {match[1]}
      </strong>,
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < content.length) {
    nodes.push(<Fragment key={`t${lastIndex}`}>{content.slice(lastIndex)}</Fragment>);
  }

  return <div className={className}>{nodes}</div>;
}
