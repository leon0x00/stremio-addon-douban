import type { MetaDetail } from "@stremio-addon/sdk";
import { type Env, Hono } from "hono";
import { z } from "zod";
import { doubanSubjectDetailCache } from "./libs/caches";
import { tmdbHttp } from "./libs/http";
import { matchResourceRoute } from "./libs/router";
import { type doubanSubjectDetailSchema, type tmdbSearchResultItemSchema, tmdbSearchResultSchema } from "./libs/schema";

export const metaRouter = new Hono<Env>();

/** 从候选结果中精确匹配 TMDB ID */
async function matchTmdbFromCandidates(
  candidates: z.output<typeof tmdbSearchResultItemSchema>[],
  item: z.output<typeof doubanSubjectDetailSchema>,
  originalTitle: string | undefined | null,
): Promise<number | null> {
  const byName = candidates.filter((v) => v.finalName === item.title);
  if (byName.length === 1) return byName[0].id;

  const toMatch = byName.length > 1 ? byName : candidates;

  if (originalTitle) {
    const byOriginal = toMatch.filter((v) => v.finalOriginalName === originalTitle);
    if (byOriginal.length === 1) return byOriginal[0].id;
    if (byOriginal.length > 1) {
      console.warn("无法精准匹配 TMDB ID (多个原始标题匹配):", byOriginal, item);
    }
  }

  return null;
}

/** 从 TMDB 搜索单个条目的 ID */
async function searchTmdbId(item: z.output<typeof doubanSubjectDetailSchema>): Promise<number | null> {
  let originalTitle = item.original_title;
  if (!originalTitle) {
    const detail = await doubanSubjectDetailCache.fetch(item.id.toString());
    originalTitle = detail?.original_title;
  }
  const resp = await tmdbHttp.get(`/search/${item.type}`, {
    params: {
      query: originalTitle || item.title,
      language: "zh-CN",
      year: item.year,
    },
  });
  const { success, data, error } = tmdbSearchResultSchema.safeParse(resp.data);
  if (!success) {
    console.warn(z.prettifyError(error));
    return null;
  }

  if (data.results.length === 0) return null;
  if (data.results.length === 1) return data.results[0].id;

  return matchTmdbFromCandidates(data.results, item, originalTitle);
}

metaRouter.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);
  if (!matched) {
    return c.json({ error: "Not found" }, 404);
  }
  if (!params.id.startsWith("douban:")) {
    return c.json({ error: "Not found" }, 404);
  }
  const [, doubanId] = params.id.split(":");
  const detail = await doubanSubjectDetailCache.fetch(doubanId);
  if (!detail) {
    return c.json({ error: "Not found" }, 404);
  }
  const meta: MetaDetail = {
    id: params.id,
    name: detail.title,
    type: detail.type === "tv" ? "series" : "movie",
    poster: detail.cover_url ?? detail.pic?.large ?? detail.pic?.normal ?? "",
    description: detail.intro ?? "",
    genres: detail.genres ?? [],
    links: [
      ...(detail.directors?.map((director) => ({
        name: director.name,
        category: "director",
        url: `https://search.douban.com/movie/subject_search?search_text=${director.name}`,
      })) ?? []),
      ...(detail.actors?.map((actor) => ({
        name: actor.name,
        category: "actor",
        url: `https://search.douban.com/movie/subject_search?search_text=${actor.name}`,
      })) ?? []),
    ],
    country: detail.countries?.join(" / "),
    awards: detail.honor_infos?.map((award) => award.title).join(" / "),
    language: detail.languages?.join(" / "),
    releaseInfo: detail.pubdate?.join(" / "),
  };
  const tmdbId = await searchTmdbId(detail);
  if (tmdbId) {
    const resp = await tmdbHttp.get<{ imdb_id: string }>(`/${detail.type}/${tmdbId}/external_ids`);
    meta.behaviorHints ??= {};
    meta.behaviorHints.defaultVideoId = resp.data.imdb_id;
    (meta as any).tmdbId = tmdbId;
    (meta as any).imdb_id = resp.data.imdb_id;
  }
  return c.json({ meta });
});
