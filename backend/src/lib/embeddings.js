// backend/src/lib/embeddings.js
import fetch from 'node-fetch';

function mockEmbedding(dim) {
  return Array.from({ length: dim }, () => Math.random() * 1e-3);
}

function normalizeVector(vec, dim) {
  if (!Array.isArray(vec)) return mockEmbedding(dim);
  if (vec.length === dim) return vec.map(Number);
  if (vec.length > dim) return vec.slice(0, dim).map(Number); // trim
  const out = vec.map(Number);
  while (out.length < dim) out.push(0); // pad
  return out;
}

export async function getEmbeddingForText(text, dims = Number(process.env.EMBEDDING_DIM || 1536)) {
  if (!text || typeof text !== 'string') return mockEmbedding(dims);

  // ---------- GEMINI ----------
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_EMBED_MODEL || 'embedding-001';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

      // First attempt: request with outputDimensionality (true MRL)
      const body1 = {
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: dims
      };

      let resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body1)
      });

      let raw = await resp.text();
      let j;
      try { j = JSON.parse(raw); } catch (e) { j = raw; }

      if (!resp.ok) {
        console.error('[GEMINI EMBED] attempt with outputDimensionality failed:', j);

        // Fallback attempt without outputDimensionality
        const body2 = {
          model: `models/${model}`,
          content: { parts: [{ text }] }
        };

        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body2)
        });
        raw = await resp.text();
        try { j = JSON.parse(raw); } catch (e) { j = raw; }
      }

      if (!resp.ok) {
        console.error('[GEMINI EMBED] second attempt failed:', j);
        return mockEmbedding(dims);
      }

      // Known shapes for embeddings
      const maybe =
        j?.embedding?.values ||
        j?.embeddings?.[0]?.values ||
        j?.results?.[0]?.embedding?.values ||
        j?.data?.[0]?.embedding ||
        null;

      if (Array.isArray(maybe) && maybe.length) {
        return normalizeVector(maybe, dims);
      }

      if (j?.error) {
        console.error('[GEMINI EMBED] API error object:', j.error);
        return mockEmbedding(dims);
      }

      console.warn('[GEMINI EMBED] unexpected response structure:', j);
      return mockEmbedding(dims);
    } catch (err) {
      console.error('[GEMINI EMBED] request failed:', err);
      // fallthrough
    }
  }

  // ---------- OPENAI ----------
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({ input: text, model })
      });
      const j = await resp.json();
      const emb = j?.data?.[0]?.embedding;
      if (Array.isArray(emb) && emb.length) return normalizeVector(emb, dims);
      console.warn('[OPENAI EMBED] unexpected response, full:', j);
      return mockEmbedding(dims);
    } catch (err) {
      console.error('[OPENAI EMBED] request failed:', err);
      return mockEmbedding(dims);
    }
  }

  // ---------- nothing available ----------
  return mockEmbedding(dims);
}
