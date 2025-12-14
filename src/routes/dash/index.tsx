import { reactRenderer } from "@hono/react-renderer";
import { type Env, Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { Link, ViteClient } from "vite-ssr-components/react";
import { tidyUpRoute } from "./tidy-up";

export const dashRoute = new Hono<Env>();

dashRoute.use(
  "*",
  reactRenderer(({ children }) => {
    return (
      <html lang="zh">
        <head>
          <ViteClient />
          <Link rel="stylesheet" href="/src/style.css" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
          />
          <title>Dashboard - Stremio 豆瓣插件</title>
        </head>
        <body>{children}</body>
      </html>
    );
  }),
);

dashRoute.use(
  basicAuth({
    verifyUser: async (username, password, c) => {
      const kv = (c.env as CloudflareBindings).KV;
      const [user, pass] = await Promise.all([kv.get("DASH_USER", "text"), kv.get("DASH_PASS", "text")]);
      if (!user || !pass) {
        return true;
      }
      if (user !== username || pass !== password) {
        return false;
      }
      return true;
    },
  }),
);

dashRoute.route("/tidy-up", tidyUpRoute);
