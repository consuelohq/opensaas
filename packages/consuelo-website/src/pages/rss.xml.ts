export const prerender = true;

import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { SITE } from "@/config";

export async function GET(context: APIContext) {
  try {
    const posts = await getCollection("blog");
    const sortedPosts = posts.sort(
      (a, b) =>
        new Date(b.data.pubDatetime).valueOf() -
        new Date(a.data.pubDatetime).valueOf()
    );

    return rss({
      title: SITE.title,
      description: SITE.desc,
      site: context.site?.toString() || SITE.website,
      items: sortedPosts.map(post => ({
        title: post.data.title,
        description: post.data.description,
        link: `/blog/${post.id}/`,
        pubDate: post.data.pubDatetime,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Failed to generate RSS feed: ${message}`, { status: 500 });
  }
}
