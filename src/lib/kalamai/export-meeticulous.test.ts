import { describe, it, expect } from "vitest";
import { toMeeticulousDraft } from "./export-meeticulous";
import { getBrand } from "./brands";
import type { ContentBlock } from "@/lib/data/types";

const brand = getBrand("meeticulous")!;
const meta = { title: "Hello World", description: "A short excerpt." };
const p = (text: string): ContentBlock => ({ type: "p", text } as ContentBlock);

describe("toMeeticulousDraft", () => {
  it("emits all six front-matter keys", () => {
    const md = toMeeticulousDraft({ meta, blocks: [p("Body")] }, brand, { date: "2026-11-14" });
    const fm = md.split("---")[1];
    for (const k of ["title", "slug", "category", "date", "author", "excerpt"]) expect(fm).toContain(`${k}:`);
    expect(fm).toContain("slug: hello-world");
    expect(fm).toContain(`author: ${brand.authorName}`);
    expect(fm).toContain(`category: ${brand.defaultCategory}`);
    expect(fm).toContain("date: 2026-11-14");
    expect(fm).toContain("excerpt: A short excerpt.");
    expect(toMeeticulousDraft({ meta, blocks: [] }, brand, { category: "Product" })).toContain("category: Product");
  });

  it("preserves inline links", () => {
    const blocks = [{ type: "p", text: ["See ", { t: "a", href: "https://x.com/a", text: "anchor" }] } as ContentBlock];
    expect(toMeeticulousDraft({ meta, blocks }, brand)).toContain("[anchor](https://x.com/a)");
  });

  it("injects ## FAQ right before faq block, and not when absent", () => {
    const faq = { type: "faq", items: [{ q: "Why?", a: "Because." }] } as ContentBlock;
    const md = toMeeticulousDraft({ meta, blocks: [p("Body"), faq] }, brand);
    expect(md).toContain("## FAQ\n\n**Why?**\n\nBecause.");
    expect(toMeeticulousDraft({ meta, blocks: [p("Body")] }, brand)).not.toContain("## FAQ");
  });

  it("does not double an existing FAQ heading", () => {
    const blocks = [{ type: "h2", text: "FAQ" }, { type: "faq", items: [{ q: "Q", a: "A" }] }] as ContentBlock[];
    expect(toMeeticulousDraft({ meta, blocks }, brand).match(/## FAQ/g)).toHaveLength(1);
  });

  it("handles zero links and zero blocks", () => {
    const md = toMeeticulousDraft({ meta, blocks: [p("Plain")] }, brand);
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain("Plain");
  });

  it("quotes values containing a colon", () => {
    const md = toMeeticulousDraft({ meta: { title: "Intro: the plan", description: "x" }, blocks: [] }, brand);
    expect(md).toContain('title: "Intro: the plan"');
    expect(md).toContain("slug: intro-the-plan");
  });
});
