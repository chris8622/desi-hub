export async function POST(req: Request) {
  const { password } = await req.json();
  const correct = process.env.APP_PASSWORD;
  if (!correct || password !== correct) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true });
}
