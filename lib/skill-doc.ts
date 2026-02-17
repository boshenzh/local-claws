import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readSkillDoc(relativePath: string): Promise<string> {
  const filePath = path.join(process.cwd(), relativePath);
  return readFile(filePath, "utf8");
}
