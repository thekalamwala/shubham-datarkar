/**
 * Brand config for the KalamAI content pipeline. A plain map, not a DB table:
 * brand facts change rarely. `categories` is the in-repo source of truth for the
 * Meeticulous blog categories, since the Meeticulous repo can't be imported here.
 */

export type Brand = {
  slug: string;
  brandFacts: string;
  authorName: string;
  defaultCategory: string;
  draftsDir: string;
  categories: string[];
};

export const BRANDS: Record<string, Brand> = {
  meeticulous: {
    slug: "meeticulous",
    // ponytail: brand facts are a tuning knob; edit here when the product story changes.
    brandFacts:
      "Meeticulous is a product founded by Shubham N Datarkar. Its blog covers product news, feature updates, " +
      "guides, and engineering notes. Write in a factual, plain voice and avoid promotional claims.",
    authorName: "Shubham N Datarkar",
    defaultCategory: "News",
    draftsDir: "D:/My Marketing/Meeticulous/Blog",
    categories: [
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
    ],
  },
};

export function getBrand(slug: string): Brand | undefined {
  return BRANDS[slug];
}
