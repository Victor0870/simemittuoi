"use client";

import type { CSSProperties } from "react";
import type { BodyLine, DocLine, DocumentLayout } from "@/lib/documents/compose";
import { AUTO_NUMBER_KEY } from "@/lib/documents/templates";

/** Cỡ chữ tính theo bề rộng trang (14pt trên khổ 210 mm), để bản xem trước giữ tỉ lệ A4 ở mọi màn hình. */
const PAPER_STYLE: CSSProperties = {
  fontFamily: "'Times New Roman', Times, serif",
  fontSize: "max(10px, 2.35cqw)",
  lineHeight: 1.3,
  padding: "9.5% 9.5% 9.5% 14.3%",
  minHeight: "141.4cqw",
};

function Runs({ line, onPick }: { line: DocLine; onPick: (key: string) => void }) {
  return (
    <>
      {line.map((run, index) => {
        const p = run.placeholder;
        if (!p) return <span key={index}>{run.text}</span>;
        if (p.key === AUTO_NUMBER_KEY) {
          return (
            <span
              key={index}
              className="mx-px rounded-sm bg-slate-100 px-0.5 font-sans text-[0.8em] font-semibold text-slate-600 ring-1 ring-slate-300"
              title="Số văn bản do hệ thống cấp tự động lúc ban hành theo Cấu hình số văn bản"
            >
              [{p.label}]
            </span>
          );
        }
        if (p.empty) {
          return (
            <button
              key={index}
              className={`mx-px rounded-sm px-0.5 font-sans text-[0.8em] font-semibold ring-1 ${
                p.required ? "bg-red-50 text-red-700 ring-red-300" : "bg-amber-50 text-amber-800 ring-amber-300"
              }`}
              title={p.required ? "Trường bắt buộc chưa nhập – bấm để nhập" : "Trường không bắt buộc – bấm để nhập"}
              type="button"
              onClick={() => onPick(p.key)}
            >
              [{p.label}]
            </button>
          );
        }
        return (
          <span
            key={index}
            className="cursor-pointer rounded-sm bg-[#e8f1ff] hover:bg-[#d5e6ff]"
            title={`${p.label} – bấm để sửa`}
            onClick={() => onPick(p.key)}
          >
            {run.text}
          </span>
        );
      })}
    </>
  );
}

function BodyParagraph({ line, onPick }: { line: BodyLine; onPick: (key: string) => void }) {
  if (line.kind === "heading") {
    return (
      <p className="my-[0.4em] text-center font-bold">
        <Runs line={line.runs} onPick={onPick} />
      </p>
    );
  }
  const kindClass =
    line.kind === "article" ? "mt-[0.4em] font-bold" : line.kind === "basis" ? "italic" : "";
  return (
    <p className={`mb-[0.25em] whitespace-pre-wrap text-justify indent-[1.4em] ${kindClass}`}>
      <Runs line={line.runs} onPick={onPick} />
    </p>
  );
}

/** Bản xem trước văn bản theo thể thức hành chính, cùng bố cục với file .docx xuất ra. */
export function DocumentPreview({ layout, onPick }: { layout: DocumentLayout; onPick: (key: string) => void }) {
  const hasFooter = Boolean(layout.recipientsHeading || layout.signatureLines.length || layout.signerName);
  return (
    <div className="@container mx-auto w-full max-w-[794px]">
      <div className="bg-white text-black shadow-[0_1px_4px_rgb(0_0_0/0.18)]" style={PAPER_STYLE}>
        <div className="grid grid-cols-[42%_58%] text-center text-[0.93em]">
          <div>
            {layout.orgLines.map((line, index) => (
              <p
                key={index}
                className={
                  (layout.orgLines.length === 1 || index === layout.orgLines.length - 1) ? "font-bold" : ""
                }
              >
                <Runs line={line} onPick={onPick} />
              </p>
            ))}
            <div className="mx-auto my-[0.25em] h-px w-[38%] bg-black" />
            {layout.numberLine ? (
              <p className="mt-[0.3em]">
                <Runs line={layout.numberLine} onPick={onPick} />
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-[0.92em] font-bold uppercase">{layout.nationalHeader}</p>
            <p className="font-bold underline underline-offset-2">{layout.nationalMotto}</p>
            {layout.placeDateLine ? (
              <p className="mt-[0.9em] italic">
                <Runs line={layout.placeDateLine} onPick={onPick} />
              </p>
            ) : null}
          </div>
        </div>

        {layout.titleLines.length || layout.subjectLine ? (
          <div className="mt-[1.4em] text-center font-bold">
            {layout.titleLines.map((line, index) => (
              <p key={index}>
                <Runs line={line} onPick={onPick} />
              </p>
            ))}
            {layout.subjectLine ? (
              <p>
                <Runs line={layout.subjectLine} onPick={onPick} />
              </p>
            ) : null}
            <div className="mx-auto mt-[0.25em] h-px w-[20%] bg-black" />
          </div>
        ) : null}

        <div className="mt-[0.9em]">
          {layout.body.map((line, index) => (
            <BodyParagraph key={index} line={line} onPick={onPick} />
          ))}
        </div>

        {hasFooter ? (
          <div className="mt-[0.9em] grid grid-cols-[47%_53%]">
            <div className="text-[0.79em]">
              {layout.recipientsHeading ? (
                <>
                  <p className="text-[1.09em] font-bold italic">{layout.recipientsHeading}</p>
                  {layout.recipients.map((line, index) => (
                    <p key={index}>
                      <Runs line={line} onPick={onPick} />
                    </p>
                  ))}
                </>
              ) : null}
            </div>
            <div className="text-center font-bold">
              {layout.signatureLines.map((line, index) => (
                <p key={index}>
                  <Runs line={line} onPick={onPick} />
                </p>
              ))}
              <div className="h-[4.5em]" />
              {layout.signerName ? (
                <p>
                  <Runs line={layout.signerName} onPick={onPick} />
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
