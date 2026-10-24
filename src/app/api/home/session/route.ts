import { NextRequest, NextResponse } from "next/server";
import { getHomeSessionInfo } from "@/lib/data/home";

export const dynamic = "force-dynamic";

const MAX_ACTIVITY_IDS = 20;

export async function GET(request: NextRequest) {
  const activityIds = (request.nextUrl.searchParams.get("activityIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 64)
    .slice(0, MAX_ACTIVITY_IDS);

  const info = await getHomeSessionInfo(activityIds);
  return NextResponse.json(info, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
