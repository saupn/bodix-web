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

export function VimeoPlayer({ videoUrl, title }: VimeoPlayerProps) {
  const parsed = parseVimeoUrl(videoUrl);
  if (!parsed) return null;

  const params = new URLSearchParams({
    badge: "0",
    autopause: "0",
    player_id: "0",
    app_id: "58479",
    loop: "1",
  });
  if (parsed.hash) params.set("h", parsed.hash);

  const embedUrl = `https://player.vimeo.com/video/${parsed.id}?${params.toString()}`;

  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <iframe
        src={embedUrl}
        className="absolute top-0 left-0 h-full w-full rounded-lg"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        title={title ?? "BodiX Workout"}
      />
    </div>
  );
}
