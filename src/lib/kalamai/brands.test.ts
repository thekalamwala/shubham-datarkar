import { describe, it, expect } from "vitest";
import { getBrand } from "./brands";

describe("getBrand", () => {
  it("returns the meeticulous brand with its author and non-empty facts", () => {
    const b = getBrand("meeticulous");
    expect(b).toBeDefined();
    expect(b!.authorName).toBe("Shubham N Datarkar");
    expect(b!.brandFacts.length).toBeGreaterThan(0);
  });

  it("exposes the Meeticulous category list including News and Feature Update", () => {
    const b = getBrand("meeticulous");
    expect(b!.categories).toEqual([
      "Announcement",
      "News",
      "Product",
      "Feature Update",
      "Guide",
      "Growth",
      "Engineering",
      "Internal",
      "Security",
      "Postmortem",
      "Money",
      "Comparison",
      "Host Story",
    ]);
    expect(b!.categories).toContain("News");
    expect(b!.categories).toContain("Feature Update");
  });

  it("uses News as the default category and the Meeticulous drafts dir", () => {
    const b = getBrand("meeticulous");
    expect(b!.defaultCategory).toBe("News");
    expect(b!.draftsDir).toBe("D:/My Marketing/Meeticulous/Blog");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getBrand("nope")).toBeUndefined();
  });
});
