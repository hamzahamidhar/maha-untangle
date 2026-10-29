// Optional AI layer. Talks to any OpenAI-compatible API:
//   OpenAI:  AI_API_KEY=sk-...                      (base URL defaults to OpenAI)
//   Gemini:  AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
//            AI_API_KEY=... AI_CHAT_MODEL=gemini-2.0-flash AI_EMBED_MODEL=text-embedding-004
//   Ollama:  AI_BASE_URL=http://localhost:11434/v1 AI_CHAT_MODEL=llama3.1 AI_EMBED_MODEL=nomic-embed-text
// With nothing set, the app runs fully on the local engine.
// Every AI call can fail; callers must fall back to the local result.

const KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
const BASE = (process.env.AI_BASE_URL || (KEY ? "https://api.openai.com/v1" : "")).replace(/\/$/, "");

export const aiConfig = {
  enabled: Boolean(BASE),
  chatModel: process.env.AI_CHAT_MODEL || "gpt-4o-mini",
  embedModel: process.env.AI_EMBED_MODEL || "text-embedding-3-small",
  useEmbeddings: process.env.AI_USE_EMBEDDINGS !== "false",
};

function headers() {
  return {
    "Content-Type": "application/json",
    ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
  };
}

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${BASE}/embeddings`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model: aiConfig.embedModel, input: texts }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Embeddings failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: aiConfig.chatModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = json.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content.replace(/^```(json)?|```$/g, "").trim()) as T;
}

export const REWRITE_SYSTEM = `You help a UAT (user acceptance testing) manager review tester feedback.
You only SUGGEST; a person approves every decision.
Rules:
- Use only facts present in the reports. Never invent steps, error messages, numbers or causes.
- If the reports might describe different problems, say so plainly.
- Be kind and specific. Never call feedback "rejected" or "invalid".
- Reply with JSON only.`;
