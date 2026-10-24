import { NextResponse } from "next/server";
import { getMyLeaderboardPosition } from "@/lib/data/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const mine = await getMyLeaderboardPosition();
  return NextResponse.json(mine, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
