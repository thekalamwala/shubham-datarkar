import type { ContentBlock } from "@/lib/data/types";
import { blocksToMarkdown } from "./serialize";
import type { Brand } from "./brands";
import type { ArticleMeta } from "./writing";

// ponytail: not reusing @/lib/utils slugify — it deletes punctuation ("a/b" -> "ab") and keeps edge hyphens.
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Quote only when YAML-significant; JSON string syntax is valid YAML.
const yamlStr = (s: string) => (/^[\w][\w .,'()/&-]*$/.test(s) && !/^(true|false|null|yes|no|\d)/i.test(s) ? s : JSON.stringify(s));

export function toMeeticulousDraft(
  article: { meta: Partial<ArticleMeta>; blocks: ContentBlock[] },
  brand: Brand,
  opts: { category?: string; slug?: string; date?: string } = {},
): string {
  const { meta, blocks } = article;
  const front = [
    ["title", meta.title ?? ""],
    ["slug", opts.slug ?? slugify(meta.title ?? "")],
    ["category", opts.category ?? brand.defaultCategory],
    ["date", opts.date ?? new Date().toISOString().slice(0, 10)],
    ["author", brand.authorName],
    ["excerpt", meta.description ?? ""],
  ].map(([k, v]) => `${k}: ${k === "date" ? v : yamlStr(v)}`);

  // blocksToMarkdown renders faq with no heading; the optimizer needs "## FAQ" to re-detect it.
  const body = blocks.flatMap((b, i): ContentBlock[] => {
    const prev = blocks[i - 1];
    const hasHeading = prev?.type === "h2" && /^faq/i.test(prev.text);
    return b.type === "faq" && !hasHeading ? [{ type: "h2", text: "FAQ" } as ContentBlock, b] : [b];
  });

  return `---\n${front.join("\n")}\n---\n\n${blocksToMarkdown(body)}`;
}
