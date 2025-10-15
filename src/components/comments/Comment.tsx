import {
  HeartIcon,
  ReplyIcon,
  RepostIcon,
  BlueskyIcon,
  MastodonIcon,
} from "./Icons";
import type { FC, PropsWithChildren } from "preact/compat";
import type { Comment } from "./useComments";

interface Props {
  comment: Comment;
}

export default function Comment({ comment }: Props) {
  const avatarSize = 14;
  return (
    <div class="flex gap-4 text-xs md:text-sm">
      <div class="flex flex-col">
        <div class="relative">
          <img
            src={comment.author.avatar}
            alt={`${comment.author.name}'s avatar`}
            class={`w-${avatarSize} h-${avatarSize} rounded-full`}
          />
          <PlatformIcon type={comment.type} />
        </div>
        <div
          class={`relative w-${avatarSize} h-${avatarSize} flex flex-grow items-center`}
        >
          {comment.replyCount > 0 && (
            <div class="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-400 dark:bg-zinc-600 transform -translate-x-1/2" />
          )}
        </div>
      </div>
      <div class="flex flex-col gap-0.5 mb-3">
        <div class="flex gap-1">
          <span class="font-bold">{comment.author.name}</span>
          <span class="text-zinc-500">
            @{comment.author.handle}
            {comment.type === "mastodon" &&
              `@${new URL(comment.url).hostname}`}{" "}
            ⋅
            <time datetime={comment.createdAt}>
              {new Date(comment.createdAt).toLocaleDateString()}
            </time>
          </span>
        </div>
        <div>
          <div
            class="prose prose-sm md:prose-base prose-zinc dark:prose-invert"
            dangerouslySetInnerHTML={{
              __html:
                comment.type === "mastodon"
                  ? comment.content
                  : escapeHtml(comment.content),
            }}
          />

          <div class="flex items-center gap-4 mt-2 text-zinc-500">
            <PostLink comment={comment}>
              <span class="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-400">
                {comment.replyCount || 0}
                <ReplyIcon size={16} />
              </span>
            </PostLink>
            <PostLink comment={comment}>
              <span class="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-400">
                {comment.repostCount || 0}
                <RepostIcon size={16} />
              </span>
            </PostLink>
            <PostLink comment={comment}>
              <span class="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-400">
                {comment.likeCount || 0}
                <HeartIcon size={16} />
              </span>
            </PostLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

interface LinkProps {
  comment: Comment;
}

const PostLink: FC<PropsWithChildren<LinkProps>> = ({ children, comment }) => (
  <a
    href={comment.url}
    target="_blank"
    rel="noopener noreferrer"
    class="no-underline"
  >
    {children}
  </a>
);

interface PlatformIconProps {
  type: "bluesky" | "mastodon";
}

const PlatformIcon: FC<PlatformIconProps> = ({ type }) => {
  const size = 20;
  return (
    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-zinc-900 rounded-full p-0.5 border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400">
      {type === "bluesky" ? (
        <BlueskyIcon size={size} />
      ) : (
        <MastodonIcon size={size} />
      )}
    </div>
  );
};
