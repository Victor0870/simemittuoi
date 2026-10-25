import {
  AlignmentType,
  BorderStyle,
  Document,
  LineRuleType,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import type { BodyLine, DocLine, DocumentLayout } from "./compose";

/** Khổ A4, lề trên / dưới 2 cm, trái 3 cm, phải 2 cm (đơn vị twip: 1 cm = 567). */
const PAGE = { width: 11906, height: 16838, top: 1134, bottom: 1134, left: 1701, right: 1134 } as const;
const CONTENT_WIDTH = PAGE.width - PAGE.left - PAGE.right;
const HEADER_COLUMNS = [3800, CONTENT_WIDTH - 3800] as const;
const FOOTER_COLUMNS = [4300, CONTENT_WIDTH - 4300] as const;
const FONT = "Times New Roman";
const FIRST_LINE_INDENT = 567;
const LINE_SPACING = { line: 288, lineRule: LineRuleType.AUTO } as const;

type RunStyle = { size: number; bold?: boolean; italics?: boolean; underline?: boolean };

function textRuns(line: DocLine, style: RunStyle, blankPlaceholder = "……"): TextRun[] {
  return line
    .map((run) => (run.placeholder?.empty ? blankPlaceholder : run.text))
    .filter((text) => text.length > 0)
    .map(
      (text) =>
        new TextRun({
          text,
          font: FONT,
          size: style.size,
          bold: style.bold,
          italics: style.italics,
          underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
        }),
    );
}

function plain(text: string): DocLine {
  return [{ text }];
}

function centered(line: DocLine, style: RunStyle, spacing: { before?: number; after?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: spacing.before ?? 0, after: spacing.after ?? 0 },
    children: textRuns(line, style),
  });
}

/** Đường kẻ ngắn dưới tên cơ quan / trích yếu. */
function shortRule(widthTwip: number, columnWidth: number): Paragraph {
  const side = Math.max(0, Math.round((columnWidth - widthTwip) / 2));
  return new Paragraph({
    indent: { left: side, right: side },
    spacing: { before: 0, after: 60, line: 120, lineRule: LineRuleType.EXACT },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
    children: [new TextRun({ text: "", font: FONT, size: 4 })],
  });
}

function cell(width: number, children: Paragraph[]): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 0, bottom: 0, left: 57, right: 57 },
    children: children.length ? children : [new Paragraph({ children: [] })],
  });
}

function twoColumnTable(widths: readonly [number, number], left: Paragraph[], right: Paragraph[]): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [...widths],
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    rows: [new TableRow({ children: [cell(widths[0], left), cell(widths[1], right)] })],
  });
}

function headerTable(layout: DocumentLayout): Table {
  const left: Paragraph[] = layout.orgLines.map((line, index) =>
    centered(line, { size: 26, bold: index === layout.orgLines.length - 1 && layout.orgLines.length > 1 ? true : layout.orgLines.length === 1 }),
  );
  left.push(shortRule(1400, HEADER_COLUMNS[0]));
  if (layout.numberLine) left.push(centered(layout.numberLine, { size: 26 }, { before: 60 }));

  const right: Paragraph[] = [
    centered(plain(layout.nationalHeader.toLocaleUpperCase("vi")), { size: 24, bold: true }),
    centered(plain(layout.nationalMotto), { size: 26, bold: true, underline: true }, { after: 120 }),
  ];
  if (layout.placeDateLine) right.push(centered(layout.placeDateLine, { size: 26, italics: true }, { before: 60 }));
  return twoColumnTable(HEADER_COLUMNS, left, right);
}

function bodyParagraph(line: BodyLine): Paragraph {
  if (line.kind === "heading") {
    return centered(line.runs, { size: 28, bold: true }, { before: 120, after: 120 });
  }
  const style: RunStyle = {
    size: 28,
    bold: line.kind === "article",
    italics: line.kind === "basis",
  };
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: FIRST_LINE_INDENT },
    spacing: { before: line.kind === "article" ? 120 : 0, after: 80, ...LINE_SPACING },
    children: textRuns(line.runs, style),
  });
}

function footerTable(layout: DocumentLayout): Table {
  const left: Paragraph[] = [];
  if (layout.recipientsHeading) {
    left.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: layout.recipientsHeading, font: FONT, size: 24, bold: true, italics: true })],
      }),
    );
    for (const line of layout.recipients) {
      left.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: textRuns(line, { size: 22 }) }));
    }
  }

  const right: Paragraph[] = layout.signatureLines.map((line) => centered(line, { size: 28, bold: true }));
  for (let k = 0; k < 4; k++) right.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }));
  if (layout.signerName) {
    right.push(new Paragraph({ alignment: AlignmentType.CENTER, children: textRuns(layout.signerName, { size: 28, bold: true }, "") }));
  }
  return twoColumnTable(FOOTER_COLUMNS, left, right);
}

/** File Word theo thể thức văn bản hành chính (A4, Times New Roman). */
export async function buildDocumentDocx(layout: DocumentLayout, title: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [headerTable(layout)];

  layout.titleLines.forEach((line, index) => {
    children.push(centered(line, { size: 28, bold: true }, { before: index === 0 ? 360 : 0 }));
  });
  if (layout.subjectLine) {
    children.push(centered(layout.subjectLine, { size: 28, bold: true }, { before: layout.titleLines.length ? 0 : 360 }));
  }
  if (layout.titleLines.length || layout.subjectLine) children.push(shortRule(1800, CONTENT_WIDTH));
  children.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }));

  for (const line of layout.body) children.push(bodyParagraph(line));

  if (layout.recipientsHeading || layout.signatureLines.length || layout.signerName) {
    children.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }));
    children.push(footerTable(layout));
  }

  const doc = new Document({
    creator: "CDILV",
    title,
    styles: { default: { document: { run: { font: FONT, size: 28 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height, orientation: PageOrientation.PORTRAIT },
            margin: { top: PAGE.top, bottom: PAGE.bottom, left: PAGE.left, right: PAGE.right },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
