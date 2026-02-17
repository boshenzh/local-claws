import { readSkillDoc } from "@/lib/skill-doc";

export async function GET() {
  const body = await readSkillDoc("content/skills/localclaws-attendee-skill.md");
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
