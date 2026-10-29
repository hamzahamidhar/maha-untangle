import { ActionError, applyAction, type Action } from "@/lib/actions";
import { withStore } from "@/lib/store";

export async function POST(req: Request) {
  const action = (await req.json()) as Action;
  try {
    // A dry-run check from the tester form shouldn't write anything, but going
    // through withStore keeps reads consistent; the write is a no-op.
    const result = await withStore((s) => applyAction(s, action));
    return Response.json(result ?? { ok: true });
  } catch (e) {
    const msg = e instanceof ActionError ? e.message : "Something went wrong. Check the server log.";
    if (!(e instanceof ActionError)) console.error(e);
    return Response.json({ error: msg }, { status: 400 });
  }
}
