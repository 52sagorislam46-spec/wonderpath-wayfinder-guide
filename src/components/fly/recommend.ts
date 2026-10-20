import type { Post } from "./types";

/**
 * "For You" recommendations + trending/viral detection.
 * Interest signals (watch time, likes, tags, authors) are kept on this device only;
 * no existing data in the database is changed.
 */

const KEY = "fly_interest_v1";
const HOUR = 3_600_000;

interface Interest {
  tags: Record<string, number>;
  authors: Record<string, number>;
  watch: Record<string, number>; // postId -> ms watched
}

let cache: Interest | null = null;

function load(): Interest {
  if (cache) return cache;
  cache = { tags: {}, authors: {}, watch: {} };
  if (typeof window === "undefined") return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) cache = { ...cache, ...(JSON.parse(raw) as Interest) };
  } catch {
    /* ignore */
  }
  return cache;
}

function save() {
  if (typeof window === "undefined" || !cache) return;
  try {
    // keep the watch map bounded
    const w = Object.entries(cache.watch);
    if (w.length > 500) cache.watch = Object.fromEntries(w.slice(-500));
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function bump(post: Post, weight: number) {
  const s = load();
  (post.tags ?? []).forEach((t) => {
    s.tags[t] = Math.min((s.tags[t] ?? 0) + weight, 100);
  });
  if (post.authorId) s.authors[post.authorId] = Math.min((s.authors[post.authorId] ?? 0) + weight, 100);
}

/** Call when a reel/video stops being watched. */
export function recordWatch(post: Post, ms: number) {
  if (!post?.id || ms < 500) return;
  const s = load();
  s.watch[post.id] = (s.watch[post.id] ?? 0) + ms;
  bump(post, Math.min(ms / 5000, 3)); // up to +3 per watch
  save();
}

/** Call when the user likes a post/reel. */
export function recordLike(post: Post, liked: boolean) {
  if (!post?.id) return;
  bump(post, liked ? 3 : -2);
  save();
}

/** Raw engagement score with time decay (Hacker-News style gravity). */
export function engagementScore(p: Post, now = Date.now()): number {
  const interactions =
    (p.likes?.length ?? 0) * 2 +
    (p.comments?.length ?? 0) * 3 +
    (p.shares ?? 0) * 4 +
    (p.views ?? 0) * 0.1;
  const ageH = Math.max(0, (now - p.createdAt) / HOUR);
  return (interactions + 1) / Math.pow(ageH + 2, 1.5);
}

/** Personalised "For You" score. */
export function forYouScore(p: Post, uid?: string, following: string[] = [], now = Date.now()): number {
  const s = load();
  const tagAffinity = (p.tags ?? []).reduce((sum, t) => sum + (s.tags[t] ?? 0), 0);
  const authorAffinity = s.authors[p.authorId] ?? 0;
  const followBoost = following.includes(p.authorId) ? 1.5 : 1;
  const alreadyWatched = s.watch[p.id] ?? 0;
  const seenPenalty = alreadyWatched > 0 ? 0.5 : 1;
  const ownPenalty = uid && p.authorId === uid ? 0.7 : 1;
  const ageH = Math.max(0, (now - p.createdAt) / HOUR);
  const freshness = 1 / Math.pow(ageH + 2, 0.8);
  return (
    (engagementScore(p, now) * 10 + tagAffinity * 0.5 + authorAffinity * 0.3 + freshness * 5) *
    followBoost *
    seenPenalty *
    ownPenalty
  );
}

export function rankForYou(posts: Post[], uid?: string, following: string[] = []): Post[] {
  const now = Date.now();
  return [...posts]
    .map((p) => ({ p, s: forYouScore(p, uid, following, now) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

/**
 * Trending hashtags: tags weighted by recent engagement, decayed by age.
 * Only looks at the last 7 days.
 */
export function trendingTags(posts: Post[], max = 8): string[] {
  const now = Date.now();
  const scores = new Map<string, number>();
  posts.forEach((p) => {
    if (now - p.createdAt > 7 * 24 * HOUR) return;
    const w = engagementScore(p, now) + 0.05;
    (p.tags ?? []).forEach((t) => scores.set(t, (scores.get(t) ?? 0) + w));
  });
  return [...scores.entries()]
    .filter(([, s]) => s > 0.1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([t]) => t);
}

/** Viral = engagement velocity well above the median of the current set. */
export function viralIds(posts: Post[]): Set<string> {
  const now = Date.now();
  const scored = posts.map((p) => ({ id: p.id, s: engagementScore(p, now), n: (p.likes?.length ?? 0) + (p.comments?.length ?? 0) + (p.shares ?? 0) }));
  if (scored.length < 3) return new Set();
  const sorted = scored.map((x) => x.s).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  return new Set(scored.filter((x) => x.n >= 5 && x.s >= Math.max(median * 3, 0.3)).map((x) => x.id));
}

/** Orders new items by score but never reshuffles items already shown. */
export function stableAppend(prevOrder: string[], ranked: Post[]): Post[] {
  const byId = new Map(ranked.map((p) => [p.id, p]));
  const kept = prevOrder.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const keptIds = new Set(kept.map((p) => p.id));
  return [...kept, ...ranked.filter((p) => !keptIds.has(p.id))];
}
