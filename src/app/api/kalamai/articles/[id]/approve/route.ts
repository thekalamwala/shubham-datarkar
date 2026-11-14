import { NextResponse, type NextRequest } from "next/server";
import { getMemberContext } from "@/lib/members/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getBrand } from "@/lib/kalamai/brands";

export const dynamic = "force-dynamic";

/** Admin approves/rejects a finished article for a brand. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getMemberContext();
  if (ctx.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const brand = getBrand(String(body.brand ?? ""));
  if (!brand) return NextResponse.json({ error: "Unknown brand." }, { status: 400 });
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be approve or reject." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: article } = await db.from("kalamai_articles").select("id, status").eq("id", id).maybeSingle();
  if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });

  let patch: Record<string, unknown>;
  if (decision === "approve") {
    if (article.status !== "complete") return NextResponse.json({ error: "Article is not finished." }, { status: 400 });
    // ponytail: category is validated but not persisted (no column); export defaults to brand.defaultCategory.
    if (body.category != null && !brand.categories.includes(String(body.category))) {
      return NextResponse.json({ error: "Invalid category for this brand." }, { status: 400 });
    }
    patch = { brand: brand.slug, publish_state: "approved" };
  } else {
    patch = { publish_state: "rejected", publish_note: body.note ? String(body.note).slice(0, 500) : null };
  }

  const { error } = await db.from("kalamai_articles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true, ...patch });
}
