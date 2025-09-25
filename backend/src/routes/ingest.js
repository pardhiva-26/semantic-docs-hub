// src/routes/ingest.js
import express from "express";
import fetch from "node-fetch";
import { query } from "../db.js";
import { getEmbeddingForText } from '../lib/embeddings.js';

const router = express.Router();
const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM || "1536", 10);
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "800", 10);

function chunkText(text, size = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push({
      text: text.slice(i, i + size),
      start: i,
      end: Math.min(i + size, text.length),
    });
  }
  return chunks;
}

function mockEmbedding(dim = EMBEDDING_DIM) {
  return Array.from({ length: dim }, () => Math.random() * 1e-3);
}

// async function callOpenAIEmbedding(text) {
//   const key = process.env.OPENAI_API_KEY;
//   if (!key) return mockEmbedding();
//   const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

//   const resp = await fetch("https://api.openai.com/v1/embeddings", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${key}`,
//     },
//     body: JSON.stringify({ input: text, model }),
//   });

//   const j = await resp.json();
//   return j?.data?.[0]?.embedding ?? mockEmbedding();
// }

router.post("/", async (req, res) => {
  try {
    const { document_id} = req.body;
    if (!document_id)
      return res.status(400).json({ error: "text or document_id required" });

    const doc = await query(`SELECT text FROM documents WHERE id = $1`, [document_id]);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    let sourceText = doc.text;
    if (!sourceText && document_id) {
      const docRes = await query(`SELECT text FROM documents WHERE id = $1`, [
        document_id,
      ]);
      if (!docRes.rows.length)
        return res.status(404).json({ error: "document not found" });
      sourceText = docRes.rows[0].text;
    }

    if (!sourceText?.trim())
      return res.status(400).json({ error: "empty text" });

    const chunks = chunkText(sourceText);
    let ingested = 0;

    for (const c of chunks) {
      // inside for (const c of chunks) { ... }
      const emb = await getEmbeddingForText(c.text, Number(process.env.EMBEDDING_DIM || 1536));
// `emb` is Array<number> length = EMBEDDING_DIM (or padded/truncated)

      // build vector string (string, NOT an array)
      const embNumbers = emb.map((x) => Number(x));
      const vectorLiteral = "[" + embNumbers.join(",") + "]";

      const insertSql = `
  INSERT INTO chunks
    (document_id, chunk_text, start_char, end_char, embedding, embedding_vec)
  VALUES
    ($1, $2, $3, $4, $5, $6::vector)
  RETURNING id, embedding_vec::text AS embedding_vec_text;
`;

      const params = [
        document_id,
        c.text,
        c.start,
        c.end,
        JSON.stringify(embNumbers), // keep JSON backup in embedding column
        vectorLiteral, // IMPORTANT: this is a string like "[0.001,0.002,...]"
      ];

      const result = await query(insertSql, params);
      console.log("Inserted chunk row:", result.rows[0]);

      ingested++;
    }

    return res.json({ status: "ok", ingested });
  } catch (err) {
    console.error("ingest error", err);
    return res
      .status(500)
      .json({ error: "ingest failed", details: String(err) });
  }
});

export default router;
