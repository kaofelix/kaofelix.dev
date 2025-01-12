---
title: Going Responsive
pubDate: 2014-02-25T19:29:00+00:00
---

<p class="intro"> After many months of silence, here comes another meta-post. My blog/test-bed-for-HTML-and-CSS-stuff-I-want-to-learn gets a redesign. One of the intentions was learning about how to make it responsive and look readable on a phone. The other is applying the learning from Hack Design, an online design course targeted at coders.</p>

I'm not going to pretend that this blog is about more than me learning and experimenting with new HTML and CSS stuff and that it is about a steady stream of posts---this time around is different though, this redesign is all the motivation I needed to start posting again! (lies).

Enough about meta-posting and motivation, let me tell you about the redesign.

## Responsive Typography

Recently I started going through this series of design material for developers called [Hack Design](http://hackdesign.org). There's some really good material in there, a great amount of it being about typography. Including a [lesson about responsive typography](http://hackdesign.org/lessons/7).

Responsive typography---as you might guess, if you're familiar with the concept of responsive design---is about changing font sizes to appropriate values based on the device displaying it.

Based on what I learned with hack design, I decided to increase the body text font size to improve readability on a laptop. We normally look at laptop screens from a distance that makes the usual 16px font size not large enough for comfortable reading. The size by itself is not the only thing that matters, as different fonts will appear smaller or bigger at the same size, so you need to experiment. I ended up with Source Sans Pro with a 20px size.

A phone tends to be held much closer to your eyes, so you can---and probably should---make the font-size smaller to keep the _measure_ at a reasonable size.

The measure is the name given to the width of your block of text and there are recommendations to set your measure to have a certain average of characters per line, as these are said to have better readability. You can see what it means with this [interactive example](http://www.kaikkonendesign.fi/typography/#section/3).

Responsive typography---and responsive design---introduces the concept of having _breakpoints_ in your page. Those are the just the exact sizes you establish on your media queries at which your design is going to change to better adapt to a particular size range. In my case, for example, I defined 2 breakpoints, one intended for screens around the width of an iPhone or Nexus in portrait mode, and another for everything else above that, but that is optimized for reading on a laptop. Ideally I'd have more breakpoints for other widths, but trying to come up with an initial release I decided to only go for this 2 extremes for now.

### New Fonts

Part of this redesign, was choosing new fonts. Since I don't have a lot of money to invest in professional fonts for my personal blog, I limited my choices to freely available web fonts. [This post](http://sachagreif.com/more-google-webfonts-that-dont-suck/) helped me narrow down the overwhelming amount of available web fonts at [Google Fonts](http://google.com/fonts/). I like the idea of deferring this effort of identifying good free fonts to people that are more knowledgeable than me on the subject, specially while I'm still learning and forming my own opinions on typography.

My previous design was all set in Helvetica Neue, which looks rather indistinctive. I went with it before because it was safe, and I like playing it safe with design. This time around, I felt that my new typographic knowledge was enough for me to feel safe choosing new fonts.

As I mentioned before, I ended up going with Source Sans Pro for body text, a free and open source font from Adobe that I particularly like the way it looks. As a perk it also has a monospaced "sister" font called Source Code Pro that I used to set my code blocks in. I feel it adds more personality to the blog than my previous choice of Helvetica Neue.

Harder to choose, was the font for post headings. I wanted to get a different one from the body text to make things more interesting. I experimented a few different choices using my free trial for [Typecast](http://typecast.com/), until I settled to PT Sans Narrow which I'm not particularly amazed about, but thing it's good enough for now.

Another font related note, is using [Font Awesome](http://fontawesome.io) for icons. The name is well deserved, it's really easy to add to your website from CDN, easy to use, and it has tons of very useful icons, including those sexy social media icons you now see on my top nav bar.

## Responsive Design

The basis for this redesign was the latest (as of this writing) version of [HTML5 Boilerplate](http://html5boilerplate.com), which is a nice simple scaffolding for building a static website with some of the latest best practices already laid out, e.g. mobile first CSS.

HTML5 boilerplate comes with normal CSS stylesheets. When I started this blog, I decided to use [Compass](http://compass-style.org) with a [Blueprint CSS](http://blueprintcss.org) grid, but that was definitely overkill. This and the fact that I don't really know how to use the blueprint grid---technically, yes, I can write the CSS; but design wise, I have no idea what I'm doing.

So I decided to start simple this time around. Of course, I wouldn't give up the power of [Sass and SCSS](http://sass-lang.com), so I installed the `jekyll-sass` processor and started to "sassify" the standard HTML5 Boilerplate CSS. Mobile first means your CSS should implement a mobile friendly layout first and make changes to adapt it to larger screens through media queries.

One problem with media queries that became evident as my CSS grew in size, was the repetition of of rules and the separation of the :

```scss
#content {
  .post {
    li {
      // < some styling for mobile >
    }
  }
  // < more styling for mobile here >
}

// < styling for more elements >

// Finally getting to the media query for bigger screens
// Notice the repetition of element structure
@media only screen and (min-width: 30em) {
  #content {
    .post {
      li {
        // < override styling for bigger screen >
      }
    }
    // < more overriding styles >
  }
}
```

Using only CSS, media queries cannot be nested within elements. You can only have it at the top level. Recent versions of Sass, though, offer this nested media queries feature that lets you write media queries within what your styling:

```scss
#content {
    .post {
        li {
            // < some styling for mobile >

            // Nested media query
            @media only screen and (min-width: 30em) {
               < override styling for bigger screen >
            }
        }
    }
    // < more styling for mobile here >
}
// <styling for more elements >
```

I like this a lot more since it keeps all the visual changes to the same elements close together in the CSS file.

In the spirit of keeping things simple I also stayed away from [Bootstrap](http://getbootstrap.com). While it offers a lot, I wouldn't use most what's there. Bootstrap's features are great for Web Applications, but I don't think a simple static page blog needs it.

The only feature from Bootstrap that I could've used, is the responsive top nav that turns into a small button when the screen is to small to show the full sized menu. I didn't want to include the whole framework just for this one feature, so I decided to try writing my own responsive menu first.

Turns out that the basics of making it were very simple. For the two different states, you just need to style it accordingly depending on the media query. When your screen width goes below your small screen breakpoint, you just need to have the nav list style to be a stack of items, hide it, and display the mobile menu button.

```scss
#mobile-menu-button {
  // style it so it looks like the button you want
  @media only screen and (min-width: 30em) {
    display: none; // Hide in large screens
  }
}

nav {
  display: none; // menu hidden by default on mobile
  @media only screen and (min-width: 30em) {
    display: block; // show nav normally in large screens
  }

  ul {
    // here there could be some styling to make your list
    // a vertical stack of fat easy to click items on mobile
    @media only screen and (min-width: 30em) {
      // and here make it a horizontal list for large screens
    }
  }
}
```

Then you need the behavior of toggling the menu when clicking the button. I started with a very simple snippet of jQuery code:

```js
$("#mobile-menu-button").on("click", function () {
  $("nav").slideToggle();
});
```

However, this has a bug. When you use `.slideToggle()` inline CSS is used to control the visibility of the element being toggled. When you toggle the first time, the element gets an appropriate `display` value to get shown. When you toggled it again, jQuery sets `display:none` directly on the element. Inline CSS has the highest priority, so it completely overrides any styling on your style sheets. That means that if you enlarge your view of the page, it changes to the large layout normally, but the menu still has `display:none` applied to it, so it's invisible.

Thinking about a desktop browser, it felt like it was a random corner case and I wouldn't need to fix it. I doubt that a whole lot of readers would

1. resize their windows as to display the mobile nav
2. toggle the mobile nav twice
3. resize the window back and see no nav

unless they were playing around and testing the responsiveness of the site. So in normal use it wouldn't have much effect.

However, in my phone, that bug was visible when turning from portrait to landscape orientation. Landscape mode was big enough to show the full menu, so if I toggled the menu while on portrait and changed to landscape, the menu would be gone.

Fixing this in JS was more of a hassle than I expected, so I ended up compromising by increasing the width on which the mobile menu appears, making the mobile menu show up in both landscape and portrait orientations.

I didn't particularly like this solution because the normal expanded menu fits perfectly on a landscape iPhone 5 or Nexus 7 (the 2 devices I tested in) and there was no reason not to give the reader access to the full menu on this situation. So I kept looking for a solution. First thought, was adding using jQuery's `.toggleClass("classname")`, instead of toggling visibility. This would involve no inline CSS being added and the element would always honor the class definition from the stylesheet, media queried and everything. Still, that would make me lose the animation.

Finally---after some "duck duck go'ing" about how to make mobile menus---I found about CSS transitions. Combined with the class approach I ended up with a solution that was

- a lot simpler,
- well support in mobile browsers,
- and degraded reasonably by losing the animation, but retaining
  the functionality.

It looks something like this:

```scss
// Button still the same
#mobile-menu-button {
  @media only screen and (min-width: 30em) {
    display: none;
  }
}

nav {
  // hide with height and overflow instead of
  // display: none
  height: 0;
  overflow: hidden;

  // use transition to animate on height
  @include transition(height 0.2s);

  @media only screen and (min-width: 30em) {
    display: block; // show nav normally in large screens
  }

  ul {
    // here there could be some styling to make your list
    // a vertical stack of fat easy to click items on mobile
    @media only screen and (min-width: 30em) {
      // and here make it a horizontal list for large screens
    }
  }
}

// This class is used to show the menu
nav.mobile-visible {
  height: XYZpx; // This needs to be calculated
  @media only screen and (min-width: 30em) {
    height: auto; // or any appropriate height for your normal nav
  }
}
```

and the jQuery for toggling would be

```js
$("#mobile-menu-button").on("click", function () {
  $("nav").toggleClass("mobile-visible");
});
```

You need to vendor prefix transition, though, but with Sass [mixins](http://sass-lang.com/guide#6) it's a breeze. Here's the implementation of the `transition` mixin used on the previous SCSS example:

```scss
@mixin transition($spec) {
  -webkit-transition: $spec;
  -moz-border-radius: $spec;
  -o-border-radius: $spec;
  transition: $spec;
}
```

## Conclusion

I must confess I was postponing learning anything about mobile for a long time and it was not until opening my old blog on my phone that I got the motivation for going down this path. The Hack Design lessons also helped me gain some knowledge and have a better idea on how to get started. Hope this becomes useful to someone, as it was useful to me to consolidate some learning.
