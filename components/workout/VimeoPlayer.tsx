"use client";

import { useEffect, useState } from "react";

interface VimeoPlayerProps {
  videoUrl: string;
  title?: string;
}

function parseVimeoUrl(videoUrl: string): { id: string; hash?: string } | null {
  const playerMatch = videoUrl.match(/player\.vimeo\.com\/video\/(\d+)(?:\?.*?h=([a-f0-9]+))?/);
  if (playerMatch) {
    return { id: playerMatch[1], hash: playerMatch[2] };
  }

  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)(?:\/([a-f0-9]+))?/);
  if (vimeoMatch) {
    return { id: vimeoMatch[1], hash: vimeoMatch[2] };
  }

  return null;
}

/**
 * Ảnh bìa + nút play; chỉ tải trình phát Vimeo (iframe + vài trăm KB JS)
 * khi người dùng bấm. Ảnh bìa lấy qua oEmbed (1 request JSON nhỏ); lỗi thì
 * giữ nền màu.
 */
export function VimeoPlayer({ videoUrl, title }: VimeoPlayerProps) {
  const parsed = parseVimeoUrl(videoUrl);
  const [playing, setPlaying] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const pageUrl = parsed
    ? `https://vimeo.com/${parsed.id}${parsed.hash ? `/${parsed.hash}` : ""}`
    : null;

  useEffect(() => {
    if (!pageUrl) return;
    const controller = new AbortController();
    fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(pageUrl)}&width=960`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { thumbnail_url?: string } | null) => {
        if (json?.thumbnail_url) setThumbnail(json.thumbnail_url);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pageUrl]);

  if (!parsed) return null;

  const params = new URLSearchParams({
    badge: "0",
    autopause: "0",
    player_id: "0",
    app_id: "58479",
    loop: "1",
    // Bấm play là thao tác của người dùng → trình duyệt cho phép tự phát.
    autoplay: "1",
  });
  if (parsed.hash) params.set("h", parsed.hash);

  const embedUrl = `https://player.vimeo.com/video/${parsed.id}?${params.toString()}`;
  const label = title ?? "BodiX Workout";

  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      {playing ? (
        <iframe
          src={embedUrl}
          className="absolute top-0 left-0 h-full w-full rounded-lg"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          title={label}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Phát video: ${label}`}
          className="group absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-primary/90"
        >
          {thumbnail && (
            // Ảnh bìa từ CDN của Vimeo – không qua next/image để khỏi phải
            // khai báo thêm remotePatterns cho domain i.vimeocdn.com.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/15" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-primary" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
