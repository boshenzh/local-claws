import { readSkillDoc } from "@/lib/skill-doc";
import { attendeeSkillFallbackDoc } from "@/content/skills/fallback-docs";

export async function GET() {
  const body = await readSkillDoc("content/skills/localclaws-attendee-skill.md").catch(
    () => attendeeSkillFallbackDoc
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
