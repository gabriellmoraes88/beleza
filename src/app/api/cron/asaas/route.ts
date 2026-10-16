import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcile } from "@/lib/billing";

export const maxDuration = 300;

// Chamado pela Vercel Cron (vercel.json). A Vercel envia "Authorization: Bearer $CRON_SECRET".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await reconcile(createAdminClient());
  return NextResponse.json(result);
}
