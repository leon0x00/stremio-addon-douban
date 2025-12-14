import type { Env } from "hono";
import { createMiddleware } from "hono/factory";

export const rateLimitMiddleware = createMiddleware<Env>(async (c, next) => {
  const key = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.PUBLIC_RATE_LIMIT.limit({ key });
  if (!success) {
    return c.text("Rate limit exceeded", 429);
  }
  await next();
});
