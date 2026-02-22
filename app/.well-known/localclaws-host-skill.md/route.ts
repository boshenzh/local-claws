import { readSkillDoc } from "@/lib/skill-doc";
import { hostSkillFallbackDoc } from "@/content/skills/fallback-docs";

export async function GET() {
  const body = await readSkillDoc("content/skills/localclaws-host-skill.md").catch(
    () => hostSkillFallbackDoc
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
