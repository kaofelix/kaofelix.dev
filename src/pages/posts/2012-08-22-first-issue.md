---
layout: "../../layouts/MarkdownPostLayout.astro"
title: First Issue
pubDate: 2012-08-22 11:37
---

I have already ran into my first issue on making this website work.
One of the first things I setup was an atom feed, which I've got from
[Alex Holmes](http://grepalex.com)'s blog
[source](https://github.com/alexholmes/blog). The issue was that I
missed a few links to change in the atom template and I've got it
published and subscribed like this. Now my feed in Google Reader has a
duplicate of my first post linking to a non existing page on Alex's
website. Google Reader also kept one of my tests on the feed. Oh well,
what can I do? I looked it up and apparently there's no way to clean
Google Reader's cache, which sucks a bit, but okay. Well, I hope it's
working now. It's being hard to test the feed is alright with all this
caching thing going on. Interestingly enough, another test I made
before wasn't cached.

I was also trying to figure out how jekyll works out the time of posts
(not only the date), and turns out it doesn't put time on posts at
all. Because of that, my atom feed that's based on the `post.date`
ends up being timed at 00:00. The workaround for this is explicitly
putting `date` with a timestamp &mdash; like `YYYY-MM-DD HH:MM`
&mdash; on the post's YAML preamble. Unfortunately, it's an extra
manual step, but I'm sure I can produce some Elisp to make this more
automatic.
