import { useBlueskyPostThread, type BlueskyPost } from "./useBlueskyPostThread";
import {
  useMastodonStatusContext,
  type MastodonStatus,
} from "./useMastodonStatusContext";

export type PostType = "bluesky" | "mastodon";

export interface Comment {
  type: PostType;
  id: string;
  uri: string;
  url: string;
  content: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  thread: Comment[];
}

export const useComments = (blueskyUri?: string, mastodonUrl?: string) => {
  const { comments: blueskyPosts } = useBlueskyPostThread(blueskyUri || "");
  const { context: mastodonStatusContext } = useMastodonStatusContext(
    mastodonUrl || "",
  );

  const commentThreads: Comment[] = [];

  if (blueskyPosts) {
    blueskyPosts.forEach((rootComment) => {
      const transformedComment = transformBlueskyPost(rootComment);
      transformedComment.thread.push(
        ...buildBlueskyThread(rootComment).map(transformBlueskyPost),
      );
      commentThreads.push(transformedComment);
    });
  }

  if (mastodonStatusContext?.descendants) {
    const statusId = mastodonUrl ? mastodonUrl.split("/").pop() || "" : "";
    const threadedComments = buildMastodonThreads(
      mastodonStatusContext.descendants,
      statusId,
    );
    commentThreads.push(...threadedComments);
  }

  const sortedComments = commentThreads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return { comments: sortedComments };
};

function buildBlueskyThread(rootComment: BlueskyPost): BlueskyPost[] {
  let comment: BlueskyPost | undefined = rootComment;
  let thread: BlueskyPost[] = [];

  while (true) {
    comment = comment.replies && comment.replies[0];
    if (!comment) break;
    thread.push(comment);
  }

  return thread;
}

function buildMastodonThreads(
  descendants: MastodonStatus[],
  rootStatusId: string,
): Comment[] {
  const topLevelReplies = descendants.filter(
    (status) => status.in_reply_to_id === rootStatusId,
  );
  const threads: Comment[] = [];

  topLevelReplies.forEach((rootReply) => {
    const transformedRoot = transformMastodonStatus(rootReply);

    function buildThread(statusId: string): Comment[] {
      const thread: Comment[] = [];
      const replies = descendants.filter(
        (status) => status.in_reply_to_id === statusId,
      );

      replies.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      replies.forEach((reply) => {
        const transformedReply = transformMastodonStatus(reply);
        transformedReply.thread = buildThread(reply.id);
        thread.push(transformedReply);
      });

      return thread;
    }

    transformedRoot.thread = buildThread(rootReply.id);
    threads.push(transformedRoot);
  });

  return threads;
}

function transformBlueskyPost(post: BlueskyPost): Comment {
  return {
    type: "bluesky",
    id: post.post.uri,
    uri: post.post.uri,
    url: `https://bsky.app/profile/${post.post.author.handle}/post/${post.post.uri.split("/").pop()}`,
    content: post.post.record.text,
    author: {
      name: post.post.author.displayName,
      handle: post.post.author.handle,
      avatar: post.post.author.avatar,
    },
    createdAt: post.post.indexedAt,
    likeCount: post.post.likeCount,
    repostCount: post.post.repostCount,
    replyCount: post.post.replyCount,
    thread: [],
  };
}

function transformMastodonStatus(status: MastodonStatus): Comment {
  return {
    type: "mastodon",
    id: status.id,
    uri: status.uri,
    url: status.url,
    content: status.content,
    author: {
      name: status.account.display_name,
      handle: status.account.username,
      avatar: status.account.avatar,
    },
    createdAt: status.created_at,
    likeCount: status.favourites_count,
    repostCount: status.reblogs_count,
    replyCount: status.replies_count,
    thread: [],
  };
}
