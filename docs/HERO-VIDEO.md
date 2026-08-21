# Using a video in the home page hero

The hero supports a background video. It is **off by default** — the poster
image is used until you point the site at a video file.

## Turning it on

1. Put your video in `public/hero/`.
2. Open `src/app/page.tsx` and set the two constants near the top:

```ts
const heroPoster = "/hero/hero-poster.jpg";
const heroVideo: string | string[] | undefined = [
  "/hero/hero.webm",
  "/hero/hero.mp4",
];
```

That's the whole change. Listing WebM first is worth it — it is typically
30–50% smaller than MP4 at the same quality, and browsers pick the first
format they support.

## When the video does NOT play

This is deliberate. The hero falls back to the poster image when:

| Condition | Why |
| --- | --- |
| Viewport under 768px | A background video is not worth a phone's data. |
| Visitor prefers reduced motion | An OS-level accessibility setting. Honoring it is not optional. |
| Browser reports Save-Data or a 2g/3g connection | Same reasoning as phones. |
| Autoplay is refused (low power mode, browser policy) | The page falls back rather than showing a frozen frame. |
| No `heroVideo` is set | The default. |

**The poster image is what most visitors actually see**, so it has to be a
genuinely good photograph — not an afterthought. It should be the video's own
first frame, so there is no visible jump when the video fades in.

## Encoding

Target **under 4MB**. A hero video is decoration; it must never delay the
headline. Aim for 1920x1080, 6–12 seconds, seamlessly looping, **no audio
track at all** (not merely muted — remove it, it is dead weight).

```bash
# MP4 (H.264) — universal support
ffmpeg -i source.mov -vf "scale=1920:-2" -c:v libx264 -crf 26 \
  -preset slow -an -movflags +faststart -t 10 public/hero/hero.mp4

# WebM (VP9) — smaller, served first where supported
ffmpeg -i source.mov -vf "scale=1920:-2" -c:v libvpx-vp9 -crf 34 \
  -b:v 0 -an -t 10 public/hero/hero.webm

# Poster — the video's first frame
ffmpeg -i source.mov -vframes 1 -q:v 2 public/hero/hero-poster.jpg
```

`-movflags +faststart` matters: it moves the index to the front of the file so
playback can begin before the whole thing downloads. `-an` strips audio.

## What makes a good hero clip

- **Slow, continuous motion.** A drifting aerial or a slow push through a
  space. Fast cuts fight the headline for attention and lose.
- **Room for text.** The headline sits over the left half on desktop. Keep
  that area uncluttered — a busy left side makes the type unreadable.
- **A clean loop.** The last frame should flow into the first. A visible jump
  every ten seconds is worse than no video.
- **Nothing that dates it.** A for-sale sign on a since-sold property, a car
  model, a season — the hero should stay true for a year.

## Sourcing

- **Kelly's own footage** is best: her listings, her market, no licensing
  question.
- **Licensed stock** (Artgrid, Storyblocks, Adobe Stock, Coverr) works if the
  license permits commercial web use. Keep the license record.
- **Never** pull footage from Zillow, another brokerage's marketing, or
  YouTube. Aerials in particular are frequently licensed per-use by the
  photographer, even when the property was the client's own listing.

## A word of caution

Video heroes are more often a downgrade than an upgrade. They cost load time
and attention, and a mediocre clip reads as less professional than a strong
photograph. Use one only if the footage is genuinely good. The infrastructure
is here either way — turning it off is deleting one line.


---

## Vertical (Reel / TikTok) footage

Phone-shot vertical video **cannot** be used as a hero background. Filling a
1440x600 hero with a 480x854 portrait clip means scaling it 3x — visibly
blurry — and cropping away 77% of the frame, usually decapitating whoever is
on screen. Footage of someone talking is worse still, since a hero is muted by
definition and reads as a broken video.

Vertical footage belongs in `VideoFeature` instead
(`src/components/video-feature.tsx`), which presents it at its natural 9:16
with a poster, a play button and sound on click — the way that content is
meant to be watched. The home page "Walk through with Kelly" section is an
example.

For the hero, shoot or license **landscape** footage: 16:9, at least 1920px
wide, slow continuous motion, no speaking.
