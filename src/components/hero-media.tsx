"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Hero background that upgrades from a poster image to video only when it
 * makes sense to. The poster always paints first, so the headline is legible
 * immediately and the Largest Contentful Paint never waits on the video.
 *
 * Video is skipped entirely when:
 *   - no videoSrc is configured
 *   - the visitor prefers reduced motion
 *   - the viewport is phone-sized (a hero video is not worth their data)
 *   - the browser reports Save-Data or a 2g/3g connection
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

export function HeroMedia({
  poster,
  videoSrc,
  children,
  overlay = "linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.35))",
  minHeight = "min-h-[600px]",
}: {
  poster: string;
  /** One path, or several formats in preference order (WebM before MP4). */
  videoSrc?: string | string[];
  children: ReactNode;
  overlay?: string;
  minHeight?: string;
}) {
  const sources = videoSrc
    ? (Array.isArray(videoSrc) ? videoSrc : [videoSrc]).filter(Boolean)
    : [];

  const [useVideo, setUseVideo] = useState(false);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!sources.length) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const phoneSized = window.matchMedia("(max-width: 767px)").matches;

    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const frugal =
      connection?.saveData === true ||
      /2g|3g/.test(connection?.effectiveType ?? "");

    if (!reducedMotion && !phoneSized && !frugal) setUseVideo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.join("|")]);

  // Autoplay can still be refused (low power mode, browser policy). If the
  // promise rejects, stay on the poster rather than showing a frozen frame.
  useEffect(() => {
    if (!useVideo) return;
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {
      setUseVideo(false);
      setReady(false);
    });
  }, [useVideo]);

  return (
    <section
      className={`relative flex ${minHeight} items-center overflow-hidden px-6 py-24 md:px-10 lg:px-16`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${poster}')` }}
      />

      {useVideo && sources.length ? (
        <video
          ref={videoRef}
          aria-hidden="true"
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          onCanPlay={() => setReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          {sources.map((src) => (
            <source key={src} src={src} type={mimeFor(src)} />
          ))}
        </video>
      ) : null}

      <div aria-hidden="true" className="absolute inset-0" style={{ background: overlay }} />

      <div className="relative mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}
