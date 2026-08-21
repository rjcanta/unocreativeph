"use client";

import { useRef, useState } from "react";

/**
 * A vertical (9:16) video presented as content rather than decoration:
 * poster first, click to play with sound, native controls once running.
 *
 * Nothing preloads beyond metadata and nothing autoplays — the visitor opts
 * in, which is the only sensible treatment for a clip with someone speaking.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  webm: "video/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

function mimeFor(src: string) {
  const extension = src.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "video/mp4";
}

export function VideoFeature({
  src,
  poster,
  label = "Play video",
}: {
  /** One path, or several formats in preference order (WebM before MP4). */
  src: string | string[];
  poster: string;
  label?: string;
}) {
  const sources = (Array.isArray(src) ? src : [src]).filter(Boolean);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function start() {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="relative aspect-[9/16] overflow-hidden bg-ink">
        <video
          ref={videoRef}
          poster={poster}
          preload="metadata"
          playsInline
          controls={playing}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          className="h-full w-full object-cover"
        >
          {sources.map((source) => (
            <source key={source} src={source} type={mimeFor(source)} />
          ))}
        </video>

        {!playing ? (
          <button
            type="button"
            onClick={start}
            aria-label={label}
            className="group absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/10"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="ml-1 h-6 w-6 fill-ink"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        ) : null}
      </div>

      <span
        aria-hidden="true"
        className="absolute -right-3 -top-3 -z-10 h-24 w-24 border border-gold/40"
      />
    </div>
  );
}
