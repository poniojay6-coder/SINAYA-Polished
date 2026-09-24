import { env } from "../../config/env.js";

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
    finish_reason?: string;
  }>;
}

export function isDeepSeekConfigured(): boolean {
  return Boolean(env.deepseek.apiKey);
}

export async function callDeepSeek(
  messages: DeepSeekMessage[]
): Promise<string> {
  if (!env.deepseek.apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not configured."
    );
  }

  const response = await fetch(
    `${env.deepseek.baseUrl}/chat/completions`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.deepseek.apiKey}`
      },

      body: JSON.stringify({
        model: env.deepseek.model,
        messages,
        stream: false,
        temperature: 0.2,
        max_tokens: 500
      }),

      signal: AbortSignal.timeout(20000)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `DeepSeek request failed with status ` +
      `${response.status}: ${errorText}`
    );
  }

  const result =
    (await response.json()) as DeepSeekResponse;

  const content =
    result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "DeepSeek returned an empty response."
    );
  }

  return content;
}