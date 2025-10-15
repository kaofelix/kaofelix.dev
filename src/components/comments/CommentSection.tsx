import Comment from "./Comment";
import type { FC } from "preact/compat";
import { useComments } from "./useComments";

interface Props {
  bskyUri?: string;
  mastodonUrl?: string;
}

export default function CommentSection({ bskyUri, mastodonUrl }: Props) {
  const getCommentPrompt = () => {
    if (bskyUri && mastodonUrl) {
      return (
        <>
          Want to leave a comment? Reply on{" "}
          <a
            href={bskyAppLink(bskyUri)}
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline"
          >
            Bluesky
          </a>{" "}
          or{" "}
          <a
            href={mastodonUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline"
          >
            Mastodon
          </a>{" "}
          and it will appear here
        </>
      );
    } else if (bskyUri) {
      return (
        <>
          Want to leave a comment? Reply on{" "}
          <a
            href={bskyAppLink(bskyUri)}
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline"
          >
            Bluesky
          </a>{" "}
          and it will appear here
        </>
      );
    } else if (mastodonUrl) {
      return (
        <>
          Want to leave a comment? Reply on{" "}
          <a
            href={mastodonUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline"
          >
            Mastodon
          </a>{" "}
          and it will appear here
        </>
      );
    }
    return null;
  };

  return (
    <section class="mt-20">
      <hr class="text-zinc-400 dark:text-zinc-600 mb-5" />
      <p class="text-xs md:text-sm text-center text-zinc-500 dark:text-zinc-400 mb-10">
        {getCommentPrompt()}
      </p>
      <CommentList bskyUri={bskyUri} mastodonUrl={mastodonUrl} />
    </section>
  );
}

interface CommentListProps {
  bskyUri?: string;
  mastodonUrl?: string;
}

const CommentList: FC<CommentListProps> = ({ bskyUri, mastodonUrl }) => {
  const { comments } = useComments(bskyUri, mastodonUrl);

  if (!comments || comments.length == 0) {
    return null;
  }

  return (
    <div>
      {comments.map((comment, index) => (
        <>
          <Comment comment={comment} />
          {comment.thread.map((reply) => (
            <Comment comment={reply} />
          ))}
          {index + 1 < comments.length && (
            <hr class="text-zinc-400 dark:text-zinc-600 mt-4 mb-4" />
          )}
        </>
      ))}
    </div>
  );
};

const bskyAppLink = (uri: string) => {
  const postId = uri.split("/").pop();
  const profile = uri.split("/")[2];
  return `https://bsky.app/profile/${profile}/post/${postId}`;
};
