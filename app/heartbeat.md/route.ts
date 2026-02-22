import { readSkillDoc } from "@/lib/skill-doc";
import { heartbeatFallbackDoc } from "@/content/skills/fallback-docs";

export async function GET() {
  const body = await readSkillDoc("content/skills/heartbeat.md").catch(
    () => heartbeatFallbackDoc
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
