import { BaseAPI } from "../base";
import { tmdbFindResultSchema, tmdbSearchResultSchema } from "./schema";

export class TmdbAPI extends BaseAPI {
  constructor() {
    super({ baseURL: "https://api.themoviedb.org/3" });
    this.axios.interceptors.request.use((config) => {
      config.headers.set("Authorization", `Bearer ${this.context.env.TMDB_API_KEY || process.env.TMDB_API_KEY}`);
      return config;
    });
  }

  async search(type: "movie" | "tv", params: { query: string; year?: string }) {
    const resp = await this.request({
      url: `/search/${type}`,
      params,
    });
    return tmdbSearchResultSchema.parse(resp);
  }

  async findById(
    externalId: string,
    externalSource:
      | "imdb_id"
      | "facebook_id"
      | "instagram_id"
      | "tvdb_id"
      | "tiktok_id"
      | "twitter_id"
      | "wikidata_id"
      | "youtube_id",
  ) {
    const resp = await this.request({
      url: `/find/${externalId}`,
      params: {
        external_source: externalSource,
        language: "zh-CN",
      },
    });
    return tmdbFindResultSchema.parse(resp);
  }

  getExternalId(type: "movie" | "tv", id: number) {
    return this.request<{
      id: number;
      imdb_id: string;
    }>({ url: `/${type}/${id}/external_ids` });
  }
}
