// backend/src/lib/llm.js
import fetch from "node-fetch";

/**
 * callLLM(systemPrompt, userPrompt)
 * - Tries Gemini (if GEMINI_API_KEY set)
 * - Falls back to OpenAI Chat Completions (if OPENAI_API_KEY set)
 * - Returns string answer or null
 */
export async function callLLM(systemPrompt, userPrompt) {
  // ---------- GEMINI ----------
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        process.env.GEMINI_API_KEY
      )}`;

      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: Number(process.env.GEMINI_MAX_TOKENS || 400),
        },
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await resp.json();
      if (!resp.ok) {
        console.error("[GEMINI CHAT] API error:", j);
        return null;
      }

      // Parse Gemini response
      const textCandidate =
        j?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("")
          .trim() ||
        j?.candidates?.[0]?.output ||
        null;

      if (textCandidate) return textCandidate;
      console.warn("[GEMINI CHAT] No text found, full response:", j);
      return null;
    } catch (err) {
      console.error("[GEMINI CHAT] failed, falling back to OpenAI:", err);
      // fallthrough to OpenAI
    }
  }

  // ---------- OPENAI ----------
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = process.env.LLM_MODEL || "gpt-4o-mini";
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: Number(process.env.LLM_MAX_TOKENS || 400),
        }),
      });

      const j = await resp.json();
      if (!resp.ok) {
        console.error("[OPENAI CHAT] API error:", j);
        return null;
      }

      const text = j?.choices?.[0]?.message?.content?.trim();
      if (text) return text;

      console.warn("[OPENAI CHAT] Unexpected response:", j);
      return null;
    } catch (err) {
      console.error("[OPENAI CHAT] failed:", err);
      return null;
    }
  }

  // ---------- nothing available ----------
  console.warn("⚠️ No GEMINI_API_KEY or OPENAI_API_KEY set — LLM unavailable");
  return null;
}
