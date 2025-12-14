import type { MetaDetail, WithCache } from "@stremio-addon/sdk";
import { eq, type SQL } from "drizzle-orm";
import { type Env, Hono } from "hono";
import { doubanMapping } from "@/db";
import { api } from "@/libs/api";
import { matchResourceRoute } from "@/libs/router";
import { isForwardUserAgent } from "@/libs/utils";

export const metaRoute = new Hono<Env>();

export const idPrefixes = ["tt", "tmdb:", "douban:"];
const idPrefixRegex = new RegExp(`^(${idPrefixes.join("|")})`);

metaRoute.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);
  if (!matched) {
    return c.notFound();
  }
  const metaId = params.id;
  if (!idPrefixRegex.test(metaId)) {
    return c.notFound();
  }

  let doubanId: string | number | undefined;
  let imdbId: string | undefined | null;
  let tmdbId: string | number | undefined | null;
  let queryCondition: SQL<unknown> | undefined;

  if (metaId.startsWith("douban:")) {
    doubanId = Number.parseInt(metaId.split(":")[1], 10);
    queryCondition = eq(doubanMapping.doubanId, doubanId);
  } else if (metaId.startsWith("tt")) {
    imdbId = metaId;
    queryCondition = eq(doubanMapping.imdbId, imdbId);
  } else if (metaId.startsWith("tmdb:")) {
    tmdbId = Number.parseInt(metaId.split(":")[1], 10);
    queryCondition = eq(doubanMapping.tmdbId, tmdbId);
  }

  if (queryCondition) {
    const [row] = await api.db.select().from(doubanMapping).where(queryCondition);
    if (row) {
      doubanId ||= row.doubanId;
      imdbId ||= row.imdbId;
      tmdbId ||= row.tmdbId;
    }
  }

  if (!doubanId && imdbId) {
    try {
      doubanId = await api.doubanAPI.getIdByImdbId(imdbId);
    } catch (error) {}
  }

  if (!doubanId) {
    return c.notFound();
  }
  const data = await api.doubanAPI.getSubjectDetail(doubanId);
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
