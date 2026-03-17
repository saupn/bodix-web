import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ReviewVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("review_videos")
    .select("*")
    .eq("id", id)
    .in("status", ["published", "sent"])
    .single();

  if (!video) {
    notFound();
  }

  // Parse Vimeo URL to get embed URL
  let embedUrl = video.video_url;
  const vimeoMatch = video.video_url.match(/vimeo\.com\/(\d+)(?:\/([a-f0-9]+))?/);
  if (vimeoMatch) {
    embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}${vimeoMatch[2] ? `?h=${vimeoMatch[2]}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{video.title}</h1>

      {/* Vimeo Player */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={embedUrl}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={video.title}
        />
      </div>

      {/* Description */}
      {video.description && (
        <p className="text-neutral-700">{video.description}</p>
      )}

      {/* Topics */}
      {video.topics_covered?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-500">Chủ đề trong video:</p>
          <div className="flex flex-wrap gap-2">
            {video.topics_covered.map((topic: string) => {
              const config: Record<string, { label: string; color: string }> = {
                form_check: { label: "Form", color: "bg-purple-100 text-purple-800" },
                pain_injury: { label: "Đau/Chấn thương", color: "bg-red-100 text-red-800" },
                nutrition: { label: "Dinh dưỡng", color: "bg-green-100 text-green-800" },
                motivation: { label: "Động lực", color: "bg-orange-100 text-orange-800" },
                schedule: { label: "Lịch tập", color: "bg-blue-100 text-blue-800" },
                other: { label: "Khác", color: "bg-neutral-100 text-neutral-800" },
              };
              const cfg = config[topic] || config.other;
              return (
                <span
                  key={topic}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${cfg.color}`}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Duration */}
      {video.duration_minutes && (
        <p className="text-sm text-neutral-500">
          Thời lượng: {video.duration_minutes} phút
        </p>
      )}

      {/* CTA */}
      <Link
        href="/app"
        className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90"
      >
        Quay lại Dashboard
      </Link>
    </div>
  );
}
