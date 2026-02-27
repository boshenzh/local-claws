export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/skill.md", url.origin);
  return Response.redirect(target, 307);
}
