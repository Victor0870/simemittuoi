import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import {
  MAX_ENTRY_IMAGES,
  decodeDataImage,
  entryImageVersion,
  isRemoteImageUrl,
  parseStoredImageUrls,
} from "@/lib/polls/entry-images";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";
const SHORT = "public, max-age=60, s-maxage=60";

/** Ảnh của bài thi đã duyệt. Đường dẫn có ?v= đúng phiên bản thì cache vĩnh viễn (ảnh đổi thì v đổi). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string; index: string }> },
) {
  const { id, entryId, index } = await params;
  const i = Number(index);
  if (!UUID_RE.test(id) || !UUID_RE.test(entryId) || !Number.isInteger(i) || i < 0 || i >= MAX_ENTRY_IMAGES) {
    return NextResponse.json({ error: "Đường dẫn ảnh không hợp lệ." }, { status: 400 });
  }

  const { data, error } = await createPublicClient()
    .from(CDILV_TABLE.pollOptions)
    .select("image_urls")
    .eq("id", entryId)
    .eq("poll_id", id)
    .eq("approval_status", "approved")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Không tải được ảnh." }, { status: 500 });
  }

  const stored = data ? parseStoredImageUrls(data.image_urls)[i] : undefined;
  if (!stored) {
    return NextResponse.json({ error: "Không tìm thấy ảnh." }, { status: 404 });
  }
  if (isRemoteImageUrl(stored)) {
    return NextResponse.redirect(stored, { status: 302, headers: { "Cache-Control": SHORT } });
  }

  const image = decodeDataImage(stored);
  if (!image) {
    return NextResponse.json({ error: "Không tìm thấy ảnh." }, { status: 404 });
  }

  const version = entryImageVersion(stored);
  const etag = `"${version}"`;
  const headers = {
    "Cache-Control": request.nextUrl.searchParams.get("v") === version ? IMMUTABLE : SHORT,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(new Uint8Array(image.body), {
    status: 200,
    headers: { ...headers, "Content-Type": image.contentType, "Content-Length": String(image.body.length) },
  });
}
