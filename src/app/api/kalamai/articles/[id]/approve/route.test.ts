import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

let role = "admin";
vi.mock("@/lib/members/session", () => ({
  getMemberContext: async () => ({ user: { id: "u1" }, role }),
}));

let article: { id: string; status: string } | null;
let updates: Record<string, unknown>[];
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: article }) }) }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { POST } from "./route";

const call = (body: unknown) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never, {
    params: Promise.resolve({ id: "a1" }),
  });

beforeEach(() => {
  role = "admin";
  article = { id: "a1", status: "complete" };
  updates = [];
});

describe("approve route", () => {
  it("approves a complete article", async () => {
    const res = await call({ brand: "meeticulous", decision: "approve" });
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ brand: "meeticulous", publish_state: "approved" });
  });
  it("persists the picked category and clears note", async () => {
    expect((await call({ brand: "meeticulous", decision: "approve", category: "Guide" })).status).toBe(200);
    expect(updates[0]).toEqual({ brand: "meeticulous", publish_state: "approved", publish_category: "Guide", publish_note: null });
  });
  it("defaults category to News", async () => {
    await call({ brand: "meeticulous", decision: "approve" });
    expect(updates[0]).toMatchObject({ publish_category: "News" });
  });
  it("400 on missing/invalid decision", async () => {
    expect((await call({ brand: "meeticulous" })).status).toBe(400);
    expect((await call({ brand: "meeticulous", decision: "publish" })).status).toBe(400);
  });
  it("null body does not 500", async () => {
    expect((await call(null)).status).toBe(400);
  });
  it("reject works on a non-complete article and leaves category alone", async () => {
    article = { id: "a1", status: "writing" };
    expect((await call({ brand: "meeticulous", decision: "reject" })).status).toBe(200);
    expect(updates[0]).not.toHaveProperty("publish_category");
  });
  it("bad category writes nothing", async () => {
    await call({ brand: "meeticulous", decision: "approve", category: "Bogus" });
    expect(updates).toHaveLength(0);
  });
  it("rejects with note", async () => {
    const res = await call({ brand: "meeticulous", decision: "reject", note: "off-topic" });
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ publish_state: "rejected", publish_note: "off-topic" });
  });
  it("403 for non-admin", async () => {
    role = "member";
    expect((await call({ brand: "meeticulous", decision: "approve" })).status).toBe(403);
    expect(updates).toHaveLength(0);
  });
  it("400 unknown brand", async () => {
    expect((await call({ brand: "nope", decision: "approve" })).status).toBe(400);
  });
  it("400 category not in allowlist", async () => {
    expect((await call({ brand: "meeticulous", decision: "approve", category: "Bogus" })).status).toBe(400);
  });
  it("400 when article not finished", async () => {
    article = { id: "a1", status: "writing" };
    expect((await call({ brand: "meeticulous", decision: "approve" })).status).toBe(400);
  });
  it("404 when article missing", async () => {
    article = null;
    expect((await call({ brand: "meeticulous", decision: "approve" })).status).toBe(404);
  });
});
