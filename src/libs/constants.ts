import type { ManifestCatalog } from "@stremio-addon/sdk";

export const SECONDS_PER_HOUR = 60 * 60;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * 24;
export const SECONDS_PER_WEEK = SECONDS_PER_DAY * 7;

export const MOVIE_RANK_ID_MAP = {
  评分最高剧情片: "film_genre_27",
  近期热门喜剧片: "ECAYN54KI",
  高分经典喜剧片: "movie_comedy",
  近期热门爱情片: "ECSAOJFTA",
  高分经典爱情片: "movie_love",
  近期热门动作片: "ECBUOLQGY",
  高分经典动作片: "movie_action",
  近期热门科幻片: "ECZYOJPLI",
  高分经典科幻片: "movie_scifi",
  近期热门动画片: "EC3UOBDQY",
  高分经典动画片: "film_genre_31",
  近期热门悬疑片: "ECPQOJP5Q",
  高分经典悬疑片: "film_genre_32",
  近期热门犯罪片: "ECLAN6LHQ",
  高分经典犯罪片: "film_genre_46",
  近期热门惊悚片: "ECBUOL2DA",
  高分经典惊悚片: "film_genre_33",
  近期热门冒险片: "ECDYOE7WY",
  高分经典冒险片: "film_genre_49",
  评分最高家庭片: "film_genre_41",
  评分最高儿童片: "film_genre_42",
  高分经典音乐片: "film_genre_39",
  高分经典历史片: "film_genre_44",
  高分经典奇幻片: "film_genre_48",
  近期热门恐怖片: "ECV4N4FBI",
  高分经典恐怖片: "film_genre_34",
  近期热门战争片: "EC6MOCTVQ",
  高分经典战争片: "film_genre_45",
  近期热门传记片: "EC3EOHEYY",
  高分经典传记片: "film_genre_43",
  高分经典歌舞片: "film_genre_40",
  高分经典武侠片: "film_genre_50",
  高分经典情色片: "film_genre_37",
  高分经典灾难片: "natural_disasters",
  高分经典西部片: "film_genre_47",
  评分最高古装片: "film_genre_51",
  高分运动电影榜: "ECCEPGM4Y",
  评分最高短片: "film_genre_36",
};

export const TV_RANK_ID_MAP = {
  近期热门大陆剧: "EC74443FY",
  高分经典大陆剧: "ECT45KVZI",
  近期热门美剧: "ECFA5DI7Q",
  高分经典美剧: "ECVACWVGI",
  高分经典英剧: "ECVACXBWI",
  近期热门日剧: "ECNA46YBA",
  高分经典日剧: "ECBQCUATA",
  近期热门韩剧: "ECBE5CBEI",
  高分经典韩剧: "EC6EC5GBQ",
  高分经典港剧: "ECVM47WUA",
  高分经典台剧: "ECBI5EL6A",
  高分经典泰剧: "ECRM5BIFQ",
  近期热门欧洲剧: "EC6I5FYHA",
  高分经典欧洲剧: "ECZY5KBOQ",
  高分动画剧集: "ECR4CRXHA",
};

export enum RankListType {
  Movie = "movie_rank_list",
  TV = "tv_rank_list",
}

export const RANK_ID_MAP: Record<RankListType, Record<string, string>> = {
  [RankListType.Movie]: MOVIE_RANK_ID_MAP,
  [RankListType.TV]: TV_RANK_ID_MAP,
};

export const collectionConfigs: ManifestCatalog[] = [
  { id: "movie_hot_gaia", name: "豆瓣热门电影", type: "movie" },
  { id: "movie_weekly_best", name: "一周口碑电影榜", type: "movie" },
  { id: "movie_real_time_hotest", name: "实时热门电影", type: "movie" },
  { id: "movie_top250", name: "豆瓣电影 Top250", type: "movie" },
  { id: "movie_showing", name: "影院热映", type: "movie" },
  {
    id: RankListType.Movie,
    name: "豆瓣电影排行榜",
    type: "movie",
    extra: [{ name: "genre", options: Object.keys(MOVIE_RANK_ID_MAP), isRequired: true, optionsLimit: 1 }],
  },
  // --
  { id: "tv_hot", name: "近期热门剧集", type: "series" },
  { id: "show_hot", name: "近期热门综艺节目", type: "series" },
  { id: "tv_animation", name: "近期热门动画", type: "series" },
  { id: "tv_real_time_hotest", name: "实时热门电视", type: "series" },
  { id: "tv_chinese_best_weekly", name: "华语口碑剧集榜", type: "series" },
  { id: "tv_global_best_weekly", name: "全球口碑剧集榜", type: "series" },
  { id: "show_chinese_best_weekly", name: "国内口碑综艺榜", type: "series" },
  { id: "show_global_best_weekly", name: "国外口碑综艺榜", type: "series" },
  {
    id: RankListType.TV,
    name: "豆瓣剧集排行榜",
    type: "series",
    extra: [{ name: "genre", options: Object.keys(TV_RANK_ID_MAP), isRequired: true, optionsLimit: 1 }],
  },
];
