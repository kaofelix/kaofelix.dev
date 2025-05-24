import Comment from "./Comment";
import { bskyAppLink, type BlueskyPost } from "./post";
import type { FC } from "preact/compat";
import { useComments } from "./useComments";

interface Props {
  uri: string;
}

function replyThread(rootComment: BlueskyPost) {
  let comment: BlueskyPost | undefined = rootComment;
  let thread = [];

  while (true) {
    comment = comment.replies && comment.replies[0];
    if (!comment) break;
    thread.push(comment);
  }

  return thread;
}

export default function CommentSection({ uri }: Props) {
  return (
    <section class="mt-20">
      <hr class="text-zinc-400 dark:text-zinc-600 mb-5" />
      <p class="text-xs md:text-sm text-center text-zinc-500 dark:text-zinc-400 mb-10">
        Want to leave a comment? Reply to{" "}
        <a
          href={bskyAppLink(uri)}
          target="_blank"
          rel="noopener noreferrer"
          class="font-bold underline"
        >
          this post in Bluesky
        </a>{" "}
        and it will appear here
      </p>
      <CommentList uri={uri} />
    </section>
  );
}

interface CommentListProps {
  uri: string;
}
const CommentList: FC<CommentListProps> = ({ uri }) => {
  const { comments } = useComments(uri);

  if (!comments || comments.length == 0) {
    return null;
  }

  return (
    <div>
      {comments.map((comment, index) => (
        <>
          <Comment comment={comment} />
          {replyThread(comment).map((reply) => (
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
