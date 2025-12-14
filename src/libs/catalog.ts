import type { ManifestCatalog } from "@stremio-addon/sdk";
import type { DoubanIdMapping } from "@/db";
import { collectionConfigs } from "./constants";

export const generateId = (doubanId: number, params?: Partial<Omit<DoubanIdMapping, "doubanId">>) => {
  if (params?.tmdbId) {
    return `tmdb:${params.tmdbId}`;
  }
  if (params?.imdbId) {
    return params.imdbId;
  }
  return `douban:${doubanId}`;
};

export const getCatalogs = async (catalogIds?: string[]) => {
  return collectionConfigs
    .filter((item) => !catalogIds || catalogIds.includes(item.id))
    .map((item) => {
      const result: ManifestCatalog = { ...item };
      result.extra ||= [];
      result.extra.push({ name: "skip" });
      return result;
    });
};
