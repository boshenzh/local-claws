import { getCityCalendar } from "@/lib/calendar";
import { jsonOk } from "@/lib/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ city: string }> }
) {
  const { city } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const tz = searchParams.get("tz") ?? undefined;
  const tags = searchParams.get("tags")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];

  const calendar = getCityCalendar({ city, from, to, tz, tags });
  return jsonOk(calendar);
}
