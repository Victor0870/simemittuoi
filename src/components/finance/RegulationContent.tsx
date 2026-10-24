import { Fragment, type ReactNode } from "react";
import { parseRegulationHeading, regulationAnchor } from "@/lib/finance/regulation";
import { POST_BOLD_PATTERN } from "@/lib/post-format";
import { POST_INLINE_IMAGE_PATTERN, isAllowedPostImageUrl } from "@/lib/post-images";

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string; anchor: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: { n: number; text: string }[] }
  | { kind: "image"; alt: string; url: string };

const IMAGE_LINE = /^!\[([^\]\n]{0,200})\]\((https:\/\/[^\s)]+)\)$/;
const UL_ITEM = /^[-•]\s+(.*)$|^\*\s+(.*)$/;
const OL_ITEM = /^(\d{1,3})[.)]\s+(.*)$/;

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] | null = null;
  let list: Extract<Block, { kind: "ul" | "ol" }> | null = null;

  const flushParagraph = () => {
    if (paragraph) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = null;
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  content.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = parseRegulationHeading(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", ...heading, anchor: regulationAnchor(index) });
      return;
    }

    const image = IMAGE_LINE.exec(line);
    if (image) {
      flushParagraph();
      flushList();
      if (isAllowedPostImageUrl(image[2])) blocks.push({ kind: "image", alt: image[1].trim(), url: image[2] });
      return;
    }

    const ul = UL_ITEM.exec(line);
    if (ul) {
      flushParagraph();
      if (list?.kind !== "ul") {
        flushList();
        list = { kind: "ul", items: [] };
      }
      list.items.push(ul[1] ?? ul[2] ?? "");
      return;
    }

    const ol = OL_ITEM.exec(line);
    if (ol) {
      flushParagraph();
      if (list?.kind !== "ol") {
        flushList();
        list = { kind: "ol", items: [] };
      }
      list.items.push({ n: Number(ol[1]), text: ol[2] });
      return;
    }

    flushList();
    (paragraph ??= []).push(line);
  });

  flushParagraph();
  flushList();
  return blocks;
}

function renderBold(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(POST_BOLD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(<Fragment key={`${key}t${last}`}>{text.slice(last, index)}</Fragment>);
    nodes.push(
      <strong key={`${key}b${index}`} className="font-bold">
        {match[1]}
      </strong>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={`${key}t${last}`}>{text.slice(last)}</Fragment>);
  return nodes;
}

function renderInline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(POST_INLINE_IMAGE_PATTERN)) {
    if (!isAllowedPostImageUrl(match[2])) continue;
    const index = match.index ?? 0;
    if (index > last) nodes.push(...renderBold(text.slice(last, index), `${key}s${last}`));
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${key}i${index}`}
        alt={match[1].trim() || "Ảnh"}
        className="my-1 inline-block h-auto max-w-full rounded-lg border border-dusty-border/60 align-middle"
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={match[2]}
      />,
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(...renderBold(text.slice(last), `${key}s${last}`));
  return nodes;
}

/** Hiển thị nội dung Quy chế chi tiêu (Chương / Điều / danh sách / ảnh); dùng cho trang đọc, bản in và xem trước. */
export function RegulationContent({ content, className = "" }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className={`text-[15px] leading-relaxed text-on-surface print:text-[12pt] print:text-black ${className}`}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case "heading":
            if (block.level === 1) {
              return (
                <h2
                  key={key}
                  className="mt-8 mb-3 scroll-mt-24 break-after-avoid text-center text-base font-extrabold uppercase tracking-wide text-[#173A67] first:mt-0 print:text-black"
                  id={block.anchor}
                >
                  {renderInline(block.text, key)}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3
                  key={key}
                  className="mt-5 mb-2 scroll-mt-24 break-after-avoid font-bold text-[#173A67] first:mt-0 print:text-black"
                  id={block.anchor}
                >
                  {renderInline(block.text, key)}
                </h3>
              );
            }
            return (
              <h4 key={key} className="mt-3 mb-1 scroll-mt-24 break-after-avoid font-bold italic first:mt-0" id={block.anchor}>
                {renderInline(block.text, key)}
              </h4>
            );
          case "paragraph":
            return (
              <p key={key} className="my-2 text-justify">
                {block.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 ? <br /> : null}
                    {renderInline(line, `${key}l${j}`)}
                  </Fragment>
                ))}
              </p>
            );
          case "ul":
            return (
              <ul key={key} className="my-2 list-disc space-y-1 pl-6">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `${key}l${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="my-2 list-decimal space-y-1 pl-6">
                {block.items.map((item, j) => (
                  <li key={j} value={item.n}>
                    {renderInline(item.text, `${key}l${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "image":
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={key}
                alt={block.alt || "Ảnh trong quy chế"}
                className="my-3 block h-auto max-w-full break-inside-avoid rounded-xl border border-dusty-border/60 bg-slate-50 print:max-h-[120mm] print:rounded-none"
                decoding="async"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={block.url}
              />
            );
        }
      })}
    </div>
  );
}
