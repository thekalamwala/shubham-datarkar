import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getBrand } from "@/lib/kalamai/brands";
import { toMeeticulousDraft } from "@/lib/kalamai/export-meeticulous";
import type { ContentBlock } from "@/lib/data/types";
import type { ArticleMeta } from "@/lib/kalamai/writing";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  blocks: ContentBlock[];
  meta: Partial<ArticleMeta>;
  publish_category: string | null;
};

function tokenOk(header: string | null, secret: string): boolean {
  const m = /^Bearer (.+)$/.exec(header ?? "");
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on unequal lengths; length alone is not secret enough to matter here.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Server-to-server read of approved Meeticulous drafts (all authors).
 * Auth: `Authorization: Bearer ${KALAMAI_PUBLISH_TOKEN}`.
 */
export async function GET(request: Request) {
  const secret = process.env.KALAMAI_PUBLISH_TOKEN;
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  if (!tokenOk(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin()
    .from("kalamai_articles")
    .select("id, blocks, meta, publish_category")
    .eq("brand", "meeticulous")
    .eq("publish_state", "approved");
  if (error) return NextResponse.json({ error: "Query failed." }, { status: 500 });

  const brand = getBrand("meeticulous");
  if (!brand) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const drafts = ((data ?? []) as Row[]).map((r) => {
    const markdown = toMeeticulousDraft({ meta: r.meta, blocks: r.blocks }, brand, {
      category: r.publish_category ?? undefined,
    });
    // Single source of truth: read the slug back out of the front-matter we just generated.
    const raw = /^slug: (.*)$/m.exec(markdown)?.[1] ?? "";
    const slug = raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
    return { id: r.id, slug, markdown };
  });
  return NextResponse.json({ drafts });
}
