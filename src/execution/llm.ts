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
    // Local dev fallback — generate a synthetic JSON response based on the
    // expected_response schema mentioned in the user prompt.
    console.log('[llm] no DEEPSEEK_API_KEY, using fallback');

    // Try to extract JSON schema from the user prompt
    let schemaHint: Record<string, any> | null = null;
    // Match: "Return ONLY valid JSON matching this schema:" followed by { ... }
    // Handles both bare JSON and ```json ... ``` code blocks
    const schemaHeader = 'Return ONLY valid JSON matching this schema:';
    const headerIdx = user.indexOf(schemaHeader);
    if (headerIdx !== -1) {
      let after = user.slice(headerIdx + schemaHeader.length);
      // Strip optional code fence (```json or ```)
      after = after.replace(/^\s*```(?:json)?\s*\n?/, '');
      // Find the first { and try to parse a complete JSON object
      const braceIdx = after.indexOf('{');
      if (braceIdx !== -1) {
        let depth = 0;
        let inStr = false;
        let escape = false;
        for (let i = braceIdx; i < after.length; i++) {
          const ch = after[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inStr) { escape = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { const json = after.slice(braceIdx, i + 1); try { schemaHint = JSON.parse(json); } catch {} break; } }
        }
      }
    }

    if (schemaHint?.properties) {
      const result: Record<string, any> = {};
      for (const [key, prop] of Object.entries(schemaHint.properties) as [string, any][]) {
        // Return null for input_ fields to trigger pause-and-resume during testing
        if (key.startsWith('input_')) { result[key] = null; continue; }
        const type = prop.type || 'string';
        if (type === 'string') result[key] = `mock_${key}`;
        else if (type === 'array') result[key] = prop.items?.type === 'string' ? ['mock_item'] : [];
        else if (type === 'object') result[key] = {};
        else if (type === 'boolean') result[key] = true;
        else if (type === 'number') result[key] = 0;
        else result[key] = null;
      }
      // Add chat_message for steps that expect it (it's usually optional)
      if (!result.chat_message) result.chat_message = `[MOCK] ${user.slice(0, 80)}`;
      return result;
    }

    // No schema found — return a generic response
    return {
      chat_message: `[MOCK] Processed: ${user.slice(0, 100)}`,
      next: null,
      actions: [],
      memory: {},
    };
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
