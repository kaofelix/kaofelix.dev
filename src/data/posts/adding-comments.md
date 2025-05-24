---
title: Adding Comments
pubDate: 2025-05-24T10:01:55Z
---

For a while now I've been wanting to add  Bluesky comments to my blog. Like many people, I believe, I first discovered this idea when I came across these post:

<div class="flex justify-center">
<blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:vjug55kidv6sye7ykr5faxxn/app.bsky.feed.post/3lbq7mxsiek2v" data-bluesky-cid="bafyreie37qtk6ldmdof2ysxjokx5pirnlbdu7hdlivkkaeok2zndql2nwm" data-bluesky-embed-color-mode="system"><p lang="en">also, any replies in this thread will appear as comments on the blog post itself. made possible by the aforementioned Open Network 🫡

ft. @shreyanjain.net&#x27;s reply below<br><br><a href="https://bsky.app/profile/did:plc:vjug55kidv6sye7ykr5faxxn/post/3lbq7mxsiek2v?ref_src=embed">[image or embed]</a></p>&mdash; Emily Liu (<a href="https://bsky.app/profile/did:plc:vjug55kidv6sye7ykr5faxxn?ref_src=embed">@emilyliu.me</a>) <a href="https://bsky.app/profile/did:plc:vjug55kidv6sye7ykr5faxxn/post/3lbq7mxsiek2v?ref_src=embed">November 25, 2024 at 12:58 AM</a></blockquote><script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
</div>

which then led me to the posts:

- https://emilyliu.me/blog/comments
- https://graysky.app/blog/2024-02-05-adding-blog-comments

Yesterday, when I decided to finally have a go at this idea, I did another search for Bluesky comments in Astro, specifically. I found [this post](https://blog.jade0x.com/post/adding-bluesky-comments-to-your-astro-blog/) from [Jade Garafola](https://blog.jade0x.com) which was a very nice starting point for me.

I pretty much copied her code and started tweaking to apply my own styles, using Tailwind like the rest of this site. When I finally got something that I thought looked good I realised that her version had the limitation that posts are resolved at build time.

So I knew it was time to dive into [Astro Client Islands](https://docs.astro.build/en/concepts/islands/#client-islands). I went back to the Astro tutorial since I remembered there was a [section there about it](https://docs.astro.build/en/tutorial/6-islands/1/). I went for the Preact integration they use in the example since I'm handy enough with React and Preact is supposedly very small and fast, so why not?

I struggled a bit to make my client island work at first. Some things are a bit obvious, in retrospect, but took quite a bit of furious tweaking an retrying.

First one was that you can't really import your Astro components from your client framework components. I should have figured that one out from the start, but it didn't help that it manifested itself with the very cryptic error message:
```
SyntaxError: Importing binding name 'default' cannot be resolved by star export entries.
```

That had me using the ancient debugging art of commenting your code out and progressively uncommenting until you see what is causing the error. Yikes?

The second was more subtle. I, being a clever pythonista, decided it would be neat to use JavaScript generators, so I wrote a function to loop over replies of replies like this:

```ts
function* replyThread(rootComment: BlueskyPost) {
  let comment = rootComment;
  while(comment.replies && comment.replies.length > 0) {
    comment = comment.replies[0];
    yield comment;
  }
}
```

which I was directly calling map on to render the replies like this

```tsx
{replyThread(comment).map((reply: any) => (
    <Comment comment={reply} />
))}
```

And it worked! In the Astro component... when I moved over to the client island I started getting

```
Unhandled Promise Rejection: Error: Objects are not valid as a child. Encountered an object with the keys {__,__b,__i,__u}.
```

After yet another frantic and desperate debugging session, I finally narrowed it down to the generator being the culprit. I changed it to a plain old loop and push to an array and it all finally worked. Why did it break? Ok, being completely honest I just guess that in the browser JS you can't map over generators, but in Node you can? At the point I faced this, I was so tired that I didn't have the curiosity or even the energy to find a proper root cause. So yeah, that might be a learning for another day.

## How did I do it?

In my astro post template I added 

```tsx
{post.data.bskyUri && <CommentSection client:load uri={post.data.bskyUri} />}
```

So, if my post has a `bskyUri`, it will now also show a comment section. There's a message with a link to the post and if there are any replies, they will show in a list below.

I'm doing that API call to fetch the main post replies like all the others. It's so neat and simple! Just a public URL, no auth or whatever.

```ts
const endpoint =
  `https://api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}`;

const { isLoading, isError, error, data: comments } = useQuery<BlueskyPost[]>(endpoint, async () => {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();
    return data.thread?.replies;
  });
```

I'm using [`preact-fetching`](https://github.com/aduth/preact-fetching) because now I'm so spoiled at work with the nice API from Apollo Client that I want some of that fanciness for myself. I know a lot of people are really anti framework, third-party packages, etc. Well, today I'm feeling like doing some `npm installs` and make my life slightly easier, why not.

I loop over all replies I fetched and render them. I first render the parent comment, then the replies to that since I want to add an `<hr>` between each conversation thread

```tsx
{comments.map((comment) => (
  <>
    <Comment comment={comment} />
    {replyThread(comment).map((reply) => (
	  <Comment comment={reply} />
    ))}
    <hr class="text-zinc-400 dark:text-zinc-600 mt-4 mb-4" />
  </>
))}
```

Finally, my reply thread fetching function, now with no generators. In the context of this function, each `rootComment` is an individual reply to the post that is linked to this blog post. So this is to fetch the replies to those to show a little conversation thread below.

```ts
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
```

The `Comment` component is basically purely visual, so it's basically one long JSX thing which is mostly html with Tailwind classes to make it look right. I won't paste it here, but the code for this blog is publicly available anyways, so feel free to check it out!

## Testing it!

So, this post also doubles as a test for it! Right now, I want to keep it simple, so I just added an extra property to my post YAML frontmatter where I can stick the `at://` post URI to link it together to it's respective comment thread. This means it's a bit awkward in that I need to first do a `git push` to publish the post, copy post it's link to Bluesky, get the post id, add to the frontmatter and do another push.

I saw some code for discovering the post automatically as well, but I think for now I will keep with this workflow and see if it ever gets painful. If does, that means I'm probably posting a lot, which would be and awesome problem to have!

Well, that's it for now!

ヾ(・ω・)メ(・ω・)ノ
