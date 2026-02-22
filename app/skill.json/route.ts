import { readSkillDoc } from "@/lib/skill-doc";
import { skillJsonFallbackDoc } from "@/content/skills/fallback-docs";

export async function GET() {
  const body = await readSkillDoc("content/skills/skill.json").catch(
    () => skillJsonFallbackDoc
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
