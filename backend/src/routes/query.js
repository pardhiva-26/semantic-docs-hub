// src/routes/query.js
import express from "express";
import fetch from "node-fetch";
import { query } from "../db.js";
import { getEmbeddingForText } from '../lib/embeddings.js';
import { callLLM } from '../lib/llm.js';


const router = express.Router();
const TOP_K = parseInt(process.env.TOP_K || "5", 10);

function dot(a, b) {
  return a.reduce((s, v, i) => s + (v || 0) * (b[i] || 0), 0);
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function cosine(a, b) {
  return dot(a, b) / (norm(a) * norm(b) || 1);
}

async function getEmbeddingForQuery(q) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

  if (!key) {
    console.warn("⚠️ No OPENAI_API_KEY found — using mock embedding.");
    return Array.from({ length: 1536 }, () => Math.random() * 1e-3);
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ input: q, model }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI API error:", errText);
      // ✅ fallback to mock embedding instead of []
      return Array.from({ length: 1536 }, () => Math.random() * 1e-3);
    }

    const j = await resp.json();
    if (!j?.data?.[0]?.embedding) {
      console.error("Unexpected embedding response:", j);
      return Array.from({ length: 1536 }, () => Math.random() * 1e-3);
    }

    return j.data[0].embedding;
  } catch (err) {
    console.error("Embedding fetch failed:", err);
    return Array.from({ length: 1536 }, () => Math.random() * 1e-3);
  }
}


async function callOpenAIChat(systemPrompt, userPrompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
    }),
  });

  const j = await resp.json();
  return j?.choices?.[0]?.message?.content ?? null;
}

router.post("/", async (req, res) => {
  try {
    const { document_id, question } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    const qEmb = await getEmbeddingForText(question, Number(process.env.EMBEDDING_DIM || 1536));
    const qEmbNums = qEmb.map((x) => Number(x));
    const qEmbLiteral = "[" + qEmbNums.join(",") + "]";
    // if using document filter or global:
    const sql = document_id
      ? `SELECT id, chunk_text, start_char, end_char, embedding_vec <=> $1::vector AS distance
         FROM chunks
         WHERE document_id = $2 AND embedding_vec IS NOT NULL
         ORDER BY embedding_vec <=> $1::vector
         LIMIT $3`
      : `SELECT id, chunk_text, start_char, end_char, embedding_vec <=> $1::vector AS distance
         FROM chunks
         WHERE embedding_vec IS NOT NULL
         ORDER BY embedding_vec <=> $1::vector
         LIMIT $2`;

    const params = document_id
      ? [qEmbLiteral, document_id, TOP_K]
      : [qEmbLiteral, TOP_K];
    const result = await query(sql, params);

    console.log("query sql params:", params);
    console.log(
      "raw result rows sample:",
      result.rows.slice(0, 5).map((r) => ({
        id: r.id,
        distance_raw: r.distance,
      }))
    );

    const topk = result.rows.map((r, i) => ({
      id: r.id,
      chunk_text: r.chunk_text,
      start_char: r.start_char,
      end_char: r.end_char,
      score: 1 - r.distance, // distance small = closer, convert if you want "score"
      distance: r.distance,
    }));

    // Build context
    const contextText = topk
      .map((t, i) => `SNIPPET ${i + 1}:\n${t.chunk_text}`)
      .join("\n\n---\n\n");
    const systemPrompt =
      "You are a helpful assistant. Use the provided CONTEXT to answer the question. Always cite snippets.";
    const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${question}\n\nAnswer concisely and include 'SOURCES' line.`;

    let answer = null;
    if (process.env.GEMINI_API_KEY) {
      answer = await callLLM(systemPrompt, userPrompt);
    }
    if (!answer) {
      const preview =
        topk[0]?.chunk_text?.slice(0, 250) ?? "No supporting text.";
      answer = `Mock answer: "${preview}"\n\nSOURCES: snippet 1`;
    }

    const sources = topk.map((t, idx) => ({
      id: t.id,
      snippet_index: idx + 1,
      start_char: t.start_char,
      end_char: t.end_char,
      score: t.score,
    }));
    return res.json({ answer, sources });
  } catch (err) {
    console.error("query error", err);
    return res
      .status(500)
      .json({ error: "query failed", details: String(err) });
  }
});

export default router;
