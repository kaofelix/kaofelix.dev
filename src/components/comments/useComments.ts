import { useQuery } from "preact-fetching";
import { type BlueskyPost } from "./post";

export const useComments = (uri: string) => {
  const endpoint = `https://api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(
    uri,
  )}`;

  const { data: comments, ...rest } = useQuery<BlueskyPost[]>(
    endpoint,
    async () => {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json();
      return data.thread?.replies;
    },
  );

  return { comments, ...rest };
};
