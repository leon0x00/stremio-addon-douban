import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { load as cheerioLoad } from "cheerio";
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context, Env } from "hono";
import z from "zod";
import { type DoubanIdMapping, doubanMapping } from "../db";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from "./constants";
import { doubanSubjectCollectionSchema, doubanSubjectDetailSchema, tmdbSearchResultSchema } from "./schema";

interface FindTmdbIdParams {
  type: "movie" | "tv";
  doubanId: number;
  originalTitle?: string;
  year?: string;
}
export class Douban {
  static PAGE_SIZE = 10;

  private _context?: Context<Env>;

  get context() {
    if (!this._context) {
      throw new Error("Context not initialized");
    }
    return this._context;
  }
  set context(context: Context<Env>) {
    this._context = context;
  }

  private axios: AxiosInstance;

  constructor() {
    this.axios = axios.create({
      baseURL: "https://frodo.douban.com/api/v2",
      adapter: "fetch",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/99/page-frame.html",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) UnifiedPCMacWechat(0xf264101d) XWEB/16390",
      },
    });
    this.axios.interceptors.request.use(async (config) => {
      const finalUri = axios.getUri(config);
      if (finalUri.startsWith("https://frodo.douban.com/")) {
        config.params ||= {};
        config.params.apiKey = this.context.env.DOUBAN_API_KEY || process.env.DOUBAN_API_KEY;
      }
      console.info("⬆️", config.method?.toUpperCase(), finalUri);
      return config;
    });
  }

  private async request<T>(config: AxiosRequestConfig & { cache?: { key: string; ttl: number } }) {
    const cache = caches.default;
    const cacheKey = new Request(`https://cache.internal/${config.cache?.key}`);

    if (config.cache) {
      const cachedRes = await cache.match(cacheKey);
      if (cachedRes) {
        console.info("⚡️ Cache Hit", config.cache.key);
        return cachedRes.json() as Promise<T>;
      }
      console.info("🐢 Cache Miss", config.cache.key);
    }

    const resp = await this.axios.request<T>(config);
    if (config.cache) {
      const response = new Response(JSON.stringify(resp.data), {
        headers: {
          "Cache-Control": `public, max-age=${config.cache.ttl / 1000}, s-maxage=${config.cache.ttl / 1000}`,
        },
      });
      this.context.executionCtx.waitUntil(cache.put(cacheKey, response));
    }
    return resp.data;
  }

  initialize(context: Context<Env>) {
    this.context = context;
  }

  get db() {
    return drizzle(this.context.env.stremio_addon_douban);
  }

  //#region Subject Collection
  async getSubjectCollection(collectionId: string, skip: string | number = 0) {
    const data = await this.request({
      url: `/subject_collection/${collectionId}/items`,
      params: {
        start: skip,
        count: Douban.PAGE_SIZE,
      },
      cache: {
        key: `subject_collection:${collectionId}:${skip}`,
        ttl: 1000 * SECONDS_PER_HOUR * 2,
      },
    });
    return doubanSubjectCollectionSchema.parse(data);
  }
  //#endregion

  //#region Subject Detail
  async getSubjectDetail(subjectId: string | number) {
    const data = await this.request({
      url: `/subject/${subjectId}`,
      cache: {
        key: `subject_detail:${subjectId}`,
        ttl: 1000 * SECONDS_PER_DAY,
      },
    });
    return doubanSubjectDetailSchema.parse(data);
  }
  //#endregion

  //#region Subject Detail Desc
  async getSubjectDetailDesc(subjectId: string | number) {
    const data = await this.request<{ html: string }>({
      url: `/subject/${subjectId}/desc`,
      cache: {
        key: `subject_detail_desc:${subjectId}`,
        ttl: 1000 * SECONDS_PER_DAY,
      },
    });
    const $ = cheerioLoad(data.html);
    const info = Array.from($(".subject-desc table").find("tr")).map((el) => {
      const $el = $(el);
      const key = $el.find("td:first-child").text().trim();
      const value = $el.find("td:last-child").text().trim();
      return [key, value];
    });
    return Object.fromEntries(info);
  }
  //#endregion

  async getDoubanIdByImdbId(imdbId: string) {
    const resp = await this.request<{ id: string }>({
      url: `https://api.douban.com/v2/movie/imdb/${imdbId}`,
      method: "POST",
      data: {
        apikey: this.context.env.DOUBAN_API_KEY || process.env.DOUBAN_API_KEY,
      },
      cache: {
        key: `douban_id_by_imdb_id:${imdbId}`,
        ttl: 1000 * SECONDS_PER_DAY,
      },
    });
    const doubanId = z.coerce.number().parse(resp.id?.split("/")?.pop());
    try {
      this.context.executionCtx.waitUntil(
        this.db.insert(doubanMapping).values({ imdbId, doubanId }).onConflictDoUpdate({
          target: doubanMapping.doubanId,
          set: { imdbId },
        }),
      );
    } catch (error) {}
    return doubanId;
  }

  async fetchDoubanIdMapping(doubanIds: number[]) {
    const rows = await this.db.select().from(doubanMapping).where(inArray(doubanMapping.doubanId, doubanIds));
    const mappingCache = new Map<number, Omit<DoubanIdMapping, "doubanId">>();
    const mappedIds = new Set<number>();
    for (const { doubanId, imdbId, tmdbId } of rows) {
      if (imdbId || tmdbId) {
        mappingCache.set(doubanId, { imdbId, tmdbId });
        mappedIds.add(doubanId);
      }
    }
    const missingIds = doubanIds.filter((id) => !mappedIds.has(id));
    return { mappingCache, missingIds };
  }

  async persistDoubanIdMapping(mappings: DoubanIdMapping[]) {
    const data = mappings.filter((item) => item.imdbId || item.tmdbId);
    if (data.length === 0) return;
    await this.db
      .insert(doubanMapping)
      .values(data)
      .onConflictDoUpdate({
        target: doubanMapping.doubanId,
        set: { imdbId: sql`excluded.imdb_id`, tmdbId: sql`excluded.tmdb_id` },
      });
  }

  private async findTmdbId(params: FindTmdbIdParams) {
    const { type, doubanId, originalTitle, year: defaultYear } = params;
    let query = originalTitle;
    let year = defaultYear;
    if (!query) {
      const detail = await this.getSubjectDetail(doubanId);
      if (detail) {
        query = detail.original_title || detail.title;
        year ||= detail.year ?? undefined;
      }
    }
    const resp = await this.request({
      url: `https://api.themoviedb.org/3/search/${type}`,
      headers: {
        Authorization: `Bearer ${this.context.env.TMDB_API_KEY || process.env.TMDB_API_KEY}`,
      },
      params: {
        query,
        year,
        language: "zh-CN",
      },
    });
    const { results, total_results } = tmdbSearchResultSchema.parse(resp);
    console.info("🔍 TMDb Search Result", total_results, results);

    if (results.length === 0) {
      return null;
    }
    // 只有一个结果，直接返回
    if (results.length === 1) {
      return results[0].id;
    }

    const nameMatches = results.filter((result) => result.title === query || result.original_title === query);
    if (nameMatches.length === 1) {
      return nameMatches[0].id;
    }

    return null;
  }

  async findExternalId(params: FindTmdbIdParams) {
    const result: DoubanIdMapping = {
      doubanId: params.doubanId,
      imdbId: null,
      tmdbId: null,
    };
    // 二者有其一即可，优先使用 IMDb ID
    try {
      const detail = await this.getSubjectDetailDesc(params.doubanId);
      if (detail?.IMDb) {
        console.info("🔍 Douban ID => IMDb ID", params.doubanId, detail.IMDb);
        result.imdbId = detail.IMDb;
      }
    } catch (error) {
      console.error("🔍 Douban ID => IMDb ID Error", params.doubanId, error);
    }
    if (!result.imdbId) {
      try {
        const tmdbId = await this.findTmdbId(params);
        if (tmdbId) {
          console.info("🔍 Douban ID => TMDb ID", params.doubanId, tmdbId);
          result.tmdbId = tmdbId;
        }
      } catch (error) {
        console.error("🔍 Douban ID => TMDb ID Error", params.doubanId, error);
      }
    }
    console.info("🔍 Douban ID => Result", params.doubanId, result);
    return result;
  }
}

export const douban = new Douban();
