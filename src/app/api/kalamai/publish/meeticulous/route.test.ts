import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

let rows: unknown[] = [];
let eqCalls: [string, unknown][] = [];
let selectArg = "";
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: (s: string) => {
        selectArg = s;
        const chain = {
          eq: (c: string, v: unknown) => {
            eqCalls.push([c, v]);
            return chain;
          },
          then: (res: (v: unknown) => unknown) => res({ data: rows, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

import { GET } from "./route";

const TOKEN = "s3cret-token";
const req = (auth?: string) =>
  new Request("http://x/api/kalamai/publish/meeticulous", { headers: auth ? { authorization: auth } : {} });

const row = {
  id: "a1",
  meta: { title: "Hello World: A Test", description: "d" },
  blocks: [{ type: "p", text: "body text" }],
  publish_category: "Guides",
};

beforeEach(() => {
  process.env.KALAMAI_PUBLISH_TOKEN = TOKEN;
  rows = [row];
  eqCalls = [];
  selectArg = "";
});
afterEach(() => {
  delete process.env.KALAMAI_PUBLISH_TOKEN;
});

describe("GET /api/kalamai/publish/meeticulous", () => {
  it("returns approved drafts with slug matching front-matter and per-article category", async () => {
    const res = await GET(req(`Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    const { drafts } = await res.json();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe("a1");
    expect(drafts[0].markdown).toContain("body text");
    expect(drafts[0].markdown).toContain("category: Guides");
    expect(drafts[0].markdown).toContain(`slug: ${drafts[0].slug}`);
    expect(drafts[0].slug).toBe("hello-world-a-test");
  });

  it("filters brand + publish_state, never by user", async () => {
    await GET(req(`Bearer ${TOKEN}`));
    expect(eqCalls).toContainEqual(["brand", "meeticulous"]);
    expect(eqCalls).toContainEqual(["publish_state", "approved"]);
    expect(eqCalls.some(([c]) => c === "user_id")).toBe(false);
    expect(selectArg).toContain("publish_category");
  });

  it("401 on missing / wrong / wrong-length token", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect((await GET(req(`Bearer ${TOKEN}x`))).status).toBe(401);
    expect((await GET(req("Bearer s3cret-tokeX"))).status).toBe(401);
    expect((await GET(req(TOKEN))).status).toBe(401);
  });

  it("503 when token env unset", async () => {
    delete process.env.KALAMAI_PUBLISH_TOKEN;
    expect((await GET(req(`Bearer ${TOKEN}`))).status).toBe(503);
  });
});
