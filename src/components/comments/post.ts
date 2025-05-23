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

export const bskyAppLink = (uri: string) => {
  const postId = uri.split("/").pop();
  const profile = uri.split("/")[2];
  return `https://bsky.app/profile/${profile}/post/${postId}`;
}
