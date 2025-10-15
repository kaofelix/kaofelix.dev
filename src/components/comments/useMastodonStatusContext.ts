import { useQuery } from "preact-fetching";

export interface MastodonStatus {
  id: string;
  uri: string;
  url: string;
  content: string;
  created_at: string;
  account: {
    id: string;
    username: string;
    display_name: string;
    url: string;
    avatar: string;
    avatar_static: string;
  };
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
}

export interface MastodonContext {
  ancestors: MastodonStatus[];
  descendants: MastodonStatus[];
}

export const useMastodonStatusContext = (url: string) => {
  const instance = getInstanceFromUrl(url);
  const statusId = getStatusIdFromUrl(url);
  const endpoint = `https://${instance}/api/v1/statuses/${statusId}/context`;

  const { data: context, ...rest } = useQuery<MastodonContext>(
    endpoint,
    async () => {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Mastodon API error: ${response.status}`);
      }

      return response.json();
    },
  );

  const comments =
    context?.descendants.filter((st) => st.in_reply_to_id === statusId) || [];

  return {
    comments,
    context,
    ...rest,
  };
};

const getInstanceFromUrl = (url: string): string => {
  const match = url.match(/https:\/\/([^\/]+)/);
  return match ? match[1] : "mastodon.social";
};

const getStatusIdFromUrl = (url: string): string => {
  const parts = url.split("/");
  return parts[parts.length - 1] || "";
};
