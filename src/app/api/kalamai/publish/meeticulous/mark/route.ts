import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { tokenMatches } from "@/lib/kalamai/publish-auth";

export const dynamic = "force-dynamic";

/**
 * Server-to-server mark-back of a publish result.
 * Auth: `Authorization: Bearer ${KALAMAI_PUBLISH_TOKEN}`.
 * Idempotent: the only effect is an update keyed by id, so repeating a call yields the same row.
 */
export async function POST(request: Request) {
  const secret = process.env.KALAMAI_PUBLISH_TOKEN;
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  if (!tokenMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as {
    id?: unknown;
    status?: unknown;
    url?: unknown;
    reason?: unknown;
  };
  const { id, status } = body;
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "id required." }, { status: 400 });
  if (status !== "published" && status !== "rejected") {
    return NextResponse.json({ error: "status must be published or rejected." }, { status: 400 });
  }

  const patch =
    status === "published"
      ? { publish_state: "published", published_url: typeof body.url === "string" ? body.url : null }
      : { publish_state: "rejected", publish_note: typeof body.reason === "string" ? body.reason : null };

  const { data, error } = await supabaseAdmin()
    .from("kalamai_articles")
    .update(patch)
    .eq("id", id)
    .select("id, publish_state, published_url")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(data);
}
