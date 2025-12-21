import { hc } from "hono/client";
import { Github, Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { User } from "@/db";
import type { AuthRoute } from "@/routes/auth";

const client = hc<AuthRoute>("/auth");

interface StarBannerProps {
  user?: User;
}

export const StarBanner: React.FC<StarBannerProps> = ({ user }) => {
  const [hasClicked, setHasClicked] = useState(false);
  const $get = client["check-star"].$get;

  const { data, isValidating } = useSWR(
    hasClicked ? "check-star" : null, // 只有点击后才启用
    async () => {
      const res = await $get();
      return res.json();
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 0,
      dedupingInterval: 1000,
    },
  );

  const handleClick = useCallback(() => {
    setHasClicked(true);
  }, []);

  const alert = useMemo(() => {
    if (user?.hasStarred) {
      return null;
    }
    return (
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-bold">使用 GitHub 登录并星标本项目即可解锁配置云同步功能</span>
          <span>修改配置后无需更换 Manifest 链接</span>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          {user ? (
            <a
              href="https://github.com/baranwang/stremio-addon-douban"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
            >
              <Star className="size-4" />
              去星标
            </a>
          ) : (
            <a href="/auth/github">
              <Github className="size-4" />
              <span>登录</span>
            </a>
          )}
        </Button>
      </div>
    );
  }, [user, handleClick]);

  // 如果已 Star，跳转到新 URL
  if (data?.hasStarred && data?.userId) {
    window.location.href = `/${data.userId}/configure`;
    return null;
  }

  return (
    <>
      {/* Loading 遮罩 */}
      {isValidating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-3 rounded-lg bg-background p-4 shadow-lg">
            <Spinner />
          </div>
        </div>
      )}

      {alert}
    </>
  );
};
