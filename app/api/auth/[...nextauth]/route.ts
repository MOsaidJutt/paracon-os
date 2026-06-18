import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`auth:${ip}`, 10, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  return handlers.POST(req);
}
