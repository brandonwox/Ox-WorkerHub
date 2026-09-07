/**
 * Custom photo tags — pure helpers. Tags are free text the taker picks or
 * types; several per photo. Suggestions are company-wide (every tag ever used
 * on any photo), with the current job's own tags first.
 */

/** Longest tag we store — keeps chips readable. */
export const MAX_TAG_LENGTH = 30;

/** Trim, collapse inner whitespace, cap the length; '' when nothing's left. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

/** Case-insensitive membership (tags compare ignoring case). */
export function hasTag(tags: string[] | undefined, tag: string): boolean {
  const t = tag.toLowerCase();
  return (tags ?? []).some((x) => x.toLowerCase() === t);
}

/** Add `tag` (normalized, deduped ignoring case) or remove it when present. */
export function toggleTag(tags: string[] | undefined, raw: string): string[] {
  const tag = normalizeTag(raw);
  const list = tags ?? [];
  if (!tag) return list;
  return hasTag(list, tag)
    ? list.filter((x) => x.toLowerCase() !== tag.toLowerCase())
    : [...list, tag];
}

/**
 * Distinct tags across `photos`, most-used first — tags used on `jobId`'s
 * photos lead (by their count on that job), then everything else company-wide
 * by overall count, ties alphabetical. The first spelling seen wins for
 * display when the same tag appears in different cases.
 */
export function collectTagSuggestions(
  photos: { jobId: string; tags?: string[] }[],
  jobId?: string
): string[] {
  const display = new Map<string, string>();
  const jobCount = new Map<string, number>();
  const allCount = new Map<string, number>();
  for (const photo of photos) {
    for (const raw of photo.tags ?? []) {
      const key = raw.toLowerCase();
      if (!display.has(key)) display.set(key, raw);
      allCount.set(key, (allCount.get(key) ?? 0) + 1);
      if (jobId && photo.jobId === jobId) {
        jobCount.set(key, (jobCount.get(key) ?? 0) + 1);
      }
    }
  }
  return [...display.keys()]
    .sort((a, b) => {
      const ja = jobCount.get(a) ?? 0;
      const jb = jobCount.get(b) ?? 0;
      if (ja !== jb) return jb - ja;
      const ca = allCount.get(a) ?? 0;
      const cb = allCount.get(b) ?? 0;
      if (ca !== cb) return cb - ca;
      return a.localeCompare(b);
    })
    .map((key) => display.get(key) as string);
}
