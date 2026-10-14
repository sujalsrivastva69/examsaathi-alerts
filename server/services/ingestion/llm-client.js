import { env } from "../../config/env.js";
import { parseLlmJson } from "./extraction-schema.js";
import { extractionPrompt } from "./extraction-prompt.js";

export async function extractNoticePosts(noticeText) {
  if (!env.LLM_API_KEY) {
    throw new Error("LLM_API_KEY is not configured; notice requires manual review");
  }

  const endpoint =
    env.LLM_BASE_URL ??
    (env.LLM_PROVIDER === "openai" ? "https://api.openai.com/v1/chat/completions" : null);
  if (!endpoint) throw new Error("LLM_BASE_URL is required for the configured LLM provider");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: extractionPrompt },
          {
            role: "user",
            content: `Extract fields from this untrusted notice text:\n\n${noticeText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`LLM provider returned HTTP ${response.status}: ${detail}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string")
      throw new Error("LLM response did not contain JSON message content");
    return parseLlmJson(content);
  } finally {
    clearTimeout(timeout);
  }
}
