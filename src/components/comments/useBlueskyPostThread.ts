import { useQuery } from "preact-fetching";
export interface BlueskyPost {
  post: {
    uri: string;
    author: {
      avatar: string;
      displayName: string;
      handle: string;
    };
    record: {
      text: string;
    };
    indexedAt: string;
    likeCount: number;
    repostCount: number;
    replyCount: number;
  };
  replies?: BlueskyPost[];
}

export const useBlueskyPostThread = (uri: string) => {
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
