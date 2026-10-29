import { connection } from "next/server";
import { aiConfig } from "@/lib/ai";
import { viewOf } from "@/lib/actions";
import { lastAiError, loadStore } from "@/lib/store";

export async function GET() {
  await connection(); // always read fresh data, never prerender
  const store = await loadStore();
  return Response.json({
    ...viewOf(store),
    ai: { enabled: aiConfig.enabled, model: aiConfig.chatModel, embeddings: aiConfig.useEmbeddings, error: lastAiError },
  });
}
