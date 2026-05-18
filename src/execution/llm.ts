import { z } from 'zod';

const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

const LLMResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    }),
  ),
});

export async function callLlm(
  system: string | null,
  user: string,
  previousMessages?: Array<{ role: string; content: string }>,
): Promise<any> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is required but not set');
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  if (previousMessages) {
    messages.push(...previousMessages);
  }
  messages.push({ role: 'user', content: user });

  const body = {
    model: 'deepseek-chat',
    messages,
    temperature: 0,
    response_format: { type: 'json_object', strict: true },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let raw: string;
  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek API ${res.status}: ${text}`);
    }

    const parsed = LLMResponseSchema.parse(await res.json());
    raw = parsed.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }

  console.log(`[llm] raw: ${raw}`);

  let result: any;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${raw}`);
  }

  if (typeof result !== 'object' || result === null) {
    throw new Error(`LLM returned non-object JSON: ${raw}`);
  }

  console.log(`[llm] parsed:`, JSON.stringify(result, null, 2));
  return result;
}
