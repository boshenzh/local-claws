import { readSkillDoc } from "@/lib/skill-doc";
import { messagingFallbackDoc } from "@/content/skills/fallback-docs";

export async function GET() {
  const body = await readSkillDoc("content/skills/messaging.md").catch(
    () => messagingFallbackDoc
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
