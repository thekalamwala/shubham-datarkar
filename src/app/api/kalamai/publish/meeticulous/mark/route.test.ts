import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

type Row = { id: string; publish_state: string; published_url: string | null; publish_note: string | null };
let rows: Row[];
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      update: (patch: Partial<Row>) => ({
        eq: (_c: string, id: string) => ({
          select: () => ({
            maybeSingle: async () => {
              const r = rows.find((x) => x.id === id);
              if (!r) return { data: null, error: null };
              Object.assign(r, patch);
              return { data: { ...r }, error: null };
            },
          }),
        }),
      }),
    }),
  }),
}));

import { POST } from "./route";

const TOKEN = "s3cret";
function req(body: unknown, token: string | null = TOKEN) {
  return new Request("http://x/api", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.KALAMAI_PUBLISH_TOKEN = TOKEN;
  rows = [{ id: "a1", publish_state: "approved", published_url: null, publish_note: null }];
});

describe("mark route", () => {
  it("published sets state + url, and a repeat is a 200 no-op", async () => {
    const body = { id: "a1", status: "published", url: "https://m.com/a" };
    const r1 = await POST(req(body));
    expect(r1.status).toBe(200);
    const j1 = await r1.json();
    expect(j1).toMatchObject({ id: "a1", publish_state: "published", published_url: "https://m.com/a" });
    const r2 = await POST(req(body));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual(j1);
  });
  it("rejected stores reason in publish_note", async () => {
    const r = await POST(req({ id: "a1", status: "rejected", reason: "dupe" }));
    expect(r.status).toBe(200);
    expect(rows[0]).toMatchObject({ publish_state: "rejected", publish_note: "dupe" });
  });
  it("401 on bad token", async () => {
    expect((await POST(req({ id: "a1", status: "published" }, "nope"))).status).toBe(401);
  });
  it("400 on invalid status / missing id", async () => {
    expect((await POST(req({ id: "a1", status: "approved" }))).status).toBe(400);
    expect((await POST(req({ status: "published" }))).status).toBe(400);
  });
  it("404 on unknown id", async () => {
    expect((await POST(req({ id: "zz", status: "published" }))).status).toBe(404);
  });
  it("503 when env unset", async () => {
    delete process.env.KALAMAI_PUBLISH_TOKEN;
    expect((await POST(req({ id: "a1", status: "published" }))).status).toBe(503);
  });
});
