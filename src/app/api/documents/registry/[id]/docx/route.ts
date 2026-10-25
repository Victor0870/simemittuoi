import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { documentFileName, layoutDocument } from "@/lib/documents/compose";
import { buildDocumentDocx } from "@/lib/documents/docx-server";
import { isUuid, loadDocumentRecord, recordFieldValues } from "@/lib/documents/registry-server";
import { loadDocumentOrgSettings } from "@/lib/documents/settings-server";
import { loadDocumentTemplate } from "@/lib/documents/templates-server";
import { createServiceClient } from "@/lib/supabase/service";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Tải lại .docx của văn bản đã ban hành: dùng nội dung đã lưu, số và ngày theo lần ban hành. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(PERMISSIONS.postsManage);
    if (guard.response) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Văn bản không hợp lệ." }, { status: 400 });

    const db = createServiceClient();
    const row = await loadDocumentRecord(db, id);
    if (!row || row.status !== "da_ban_hanh") {
      return NextResponse.json({ error: "Không tìm thấy văn bản đã ban hành." }, { status: 404 });
    }
    const [template, settings] = await Promise.all([loadDocumentTemplate(db, row.template_id), loadDocumentOrgSettings(db)]);
    if (!template) return NextResponse.json({ error: "Không tìm thấy mẫu của văn bản." }, { status: 404 });

    const values = recordFieldValues(row);
    const dateField = template.fields.find((f) => f.key === "ngay" && f.type === "date");
    if (dateField && row.ngay_ban_hanh) values[dateField.key] = row.ngay_ban_hanh;

    const layout = layoutDocument(template.body, template.fields, values, settings);
    if (layout.numberLine && row.so_van_ban) layout.numberLine = [{ text: `Số: ${row.so_van_ban}` }];

    const buffer = await buildDocumentDocx(layout, row.title);
    const fileName = documentFileName(template.docType, row.title, { so_van_ban: row.so_van_ban ?? "" });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[api/documents/registry/[id]/docx] GET error:", err);
    return NextResponse.json({ error: "Không xuất được file Word." }, { status: 500 });
  }
}
