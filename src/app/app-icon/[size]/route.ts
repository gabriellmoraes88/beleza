import { appIcon } from "@/lib/app-icon";

const SIZES = new Set([96, 192, 512]);

export async function GET(_request: Request, ctx: RouteContext<"/app-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Não encontrado", { status: 404 });
  return appIcon(size, { "Cache-Control": "public, max-age=86400" });
}
