import type { MetaDetail, WithCache } from "@stremio-addon/sdk";
import { eq } from "drizzle-orm";
import { type Env, Hono } from "hono";
import { doubanMapping } from "./db";
import { douban } from "./libs/douban";
import { matchResourceRoute } from "./libs/router";
import { isForwardUserAgent } from "./libs/utils";

export const metaRouter = new Hono<Env>();

export const idPrefixes = ["tt", "tmdb:", "douban:"];
const idPrefixRegex = new RegExp(`^(${idPrefixes.join("|")})`);

metaRouter.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);
  if (!matched) {
    return c.json({ error: "Not found" }, 404);
  }
  const metaId = params.id;
  if (!idPrefixRegex.test(metaId)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  douban.initialize(c);
  const db = douban.db;
  let doubanId: string | number | undefined;
  let imdbId: string | undefined | null;
  let tmdbId: string | number | undefined | null;

  if (metaId.startsWith("douban:")) {
    doubanId = Number.parseInt(metaId.split(":")[1], 10);
  } else if (metaId.startsWith("tt")) {
    imdbId = metaId;
  } else if (metaId.startsWith("tmdb:")) {
    tmdbId = Number.parseInt(metaId.split(":")[1], 10);
  }

  const queryCondition = doubanId
    ? eq(doubanMapping.doubanId, Number.parseInt(doubanId.toString(), 10))
    : imdbId
      ? eq(doubanMapping.imdbId, imdbId)
      : tmdbId
        ? eq(doubanMapping.tmdbId, Number.parseInt(tmdbId.toString(), 10))
        : undefined;

  if (queryCondition) {
    const [row] = await db.select().from(doubanMapping).where(queryCondition);
    if (row) {
      doubanId ||= row.doubanId;
      imdbId ||= row.imdbId;
      tmdbId ||= row.tmdbId;
    }
  }

  if (!doubanId && imdbId) {
    try {
      doubanId = await douban.getDoubanIdByImdbId(imdbId);
    } catch (error) {}
  }

  if (!doubanId) {
    return c.json({ error: "Not found" }, 404);
  }
  const data = await douban.getSubjectDetail(doubanId);
  const meta: MetaDetail & { [key: string]: any } = {
    id: metaId,
    type: data.type === "tv" ? "series" : "movie",
    name: data.title,
    poster: data.cover_url || data.pic?.large || data.pic?.normal || "",
    description: data.intro ?? undefined,
    genres: data.genres ?? undefined,
    links: [
      ...(data.directors ?? []).map((item) => ({ name: item.name, category: "director", url: "" })),
      ...(data.actors ?? []).map((item) => ({ name: item.name, category: "actor", url: "" })),
    ],
    language: data.languages?.join(" / "),
    country: data.countries?.join(" / "),
    awards: data.honor_infos?.map((item) => item.title).join(" / "),
  };
  meta.behaviorHints ||= {};
  const isInForward = isForwardUserAgent(c);
  if (tmdbId) {
    if (isInForward) {
      meta.tmdb_id = `tmdb:${tmdbId}`;
    } else {
      meta.tmdbId = tmdbId;
    }
    meta.behaviorHints.defaultVideoId = `tmdb:${tmdbId}`;
  }
  if (imdbId) {
    meta.imdb_id = imdbId;
    meta.behaviorHints.defaultVideoId = imdbId;
  }

  return c.json({
    meta,
  } satisfies WithCache<{ meta: MetaDetail }>);
});
