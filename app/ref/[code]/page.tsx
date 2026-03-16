import { redirect } from "next/navigation";

/** Alias: /ref/LAN → /r/LAN */
export default async function RefRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const trimmed = code?.trim();
  if (!trimmed) redirect("/");
  redirect(`/r/${trimmed}`);
}
