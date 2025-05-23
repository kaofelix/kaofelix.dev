import { bskyAppLink, type BlueskyPost } from "./post";
import { HeartIcon, ReplyIcon, RepostIcon } from "./Icons";
import type { FC, PropsWithChildren } from "preact/compat";

interface Props {
  comment: BlueskyPost;
}
export default function Comment({ comment }: Props) {
  return (
    <div class="mb-3 flex gap-3">
      <div class="flex flex-col gap-1">
        <img
          src={comment.post.author.avatar}
          alt={`${comment.post.author.displayName}'s avatar`}
          class="w-10 h-10 rounded-full"
        />
        <div class="relative w-10 h-10 flex self-stretch items-center">
          {comment.post.replyCount > 0 && comment.replies && (
            <div class="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-400 dark:bg-zinc-600 transform -translate-x-1/2" />
          )}
        </div>
      </div>
      <div class="flex flex-col gap-0.5">
        <div class="text-sm flex gap-1">
          <span class="font-bold">{comment.post.author.displayName}</span>
          <span class="text-zinc-400 dark:text-zinc-600">
            @{comment.post.author.handle}{" "}
            ⋅
            <time datetime={comment.post.indexedAt} >
              {new Date(comment.post.indexedAt).toLocaleDateString()}
            </time>
          </span>
        </div>
        <div>
          <PostLink post={comment}>
            <div class="comment-content">{comment.post.record.text}</div>
          </PostLink>

          <div class="flex items-center gap-4 mt-2 text-sm text-zinc-400 dark:text-zinc-600">
            <PostLink post={comment}>
              <span class="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-400">
                {comment.post.replyCount || 0}
                <ReplyIcon size={16} />
              </span>
            </PostLink>
            <PostLink post={comment}>
              <span class="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-400">
                {comment.post.repostCount || 0}
                <RepostIcon size={16} />
              </span>
            </PostLink>
            <PostLink post={comment}>
              <span class="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-400">
                {comment.post.likeCount || 0}
                <HeartIcon size={16} />
              </span>
            </PostLink>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LinkProps {
  post: BlueskyPost
}
const PostLink: FC<PropsWithChildren<LinkProps>> = ({children, post}) =>
  <a href={bskyAppLink(post.post.uri)} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
