# Semantic Documents Hub

A lightweight self-hosted app to upload PDFs, generate embeddings, index them in PostgreSQL (with pgvector support), and ask questions over your documents using an LLM (Gemini / OpenAI) — with sensible fallbacks to mocked embeddings/LLMs if keys are missing.

---

## Table of Contents

- [Project Layout](#project-layout)
- [Quick Start](#quick-start)
- [Database Setup (Postgres + pgvector)](#database-setup-postgres--pgvector)
- [Backend: Run Locally](#backend-run-locally)
- [Frontend: Run Locally](#frontend-run-locally)
- [API Endpoints](#api-endpoints)
- [Embeddings & LLMs: Gemini vs OpenAI](#embeddings--llms-gemini-vs-openai)
- [Note on Gemini Scaling / MRL](#note-on-gemini-scaling--mrl)

---

## Project Layout

```
backend/
  src/
    routes/
      upload.js
      ingest.js
      query.js
    lib/
      embeddings.js
      llm.js
    db.js
    index.js
  package.json
frontend/
  src/
    components/
      Upload.jsx
      Viewer.jsx
      QA.jsx
    App.jsx
  package.json
.gitignore
README.md
.env.example
```

---

## Quick Start

1. **Prepare PostgreSQL with pgvector installed** (recommended: Docker ankane/pgvector image).
2. **Create a database** named `semanticdb` and run the SQL migrations below to create `documents` and `chunks` tables with vector column/index.
3. **Configure `.env`** with database credentials and API keys (Gemini or OpenAI).
4. **Start the backend** (Node/Express).
5. **Start the frontend** (React).
6. **Upload a PDF**, click "Ingest," then ask questions in the QA panel.

---

## Database Setup (Postgres + pgvector)

**Recommended:** Use the [ankane/pgvector Docker image](https://hub.docker.com/r/ankane/pgvector), which includes the pgvector extension.

### 1) Run Postgres with pgvector

#### Linux / macOS (bash):

```bash
# Create a local data directory (in backend/)
mkdir -p ./data

docker run -d \
  --name semantic-postgres \
  -e POSTGRES_PASSWORD=pass \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=semanticdb \
  -p 5432:5432 \
  -v "$(pwd)/data":/var/lib/postgresql/data \
  ankane/pgvector:latest
```

#### Windows PowerShell:

```powershell
mkdir data
docker run -d --name semantic-postgres -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=postgres -e POSTGRES_DB=semanticdb -p 5432:5432 -v ${PWD}\data:/var/lib/postgresql/data ankane/pgvector:latest
```

Wait for the container to initialize. Check progress with:

```bash
docker logs semantic-postgres -f
```

If port 5432 is in use, change the `-p` host port (e.g., `-p 5433:5432`).

### 2) Connect to the Database

```bash
docker exec -it semantic-postgres psql -U postgres -d semanticdb
```

### 3) Enable Extension and Run Migrations

Run the following SQL in `psql`:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title TEXT,
  text TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Chunks table (stores chunk text + JSON embedding + vector column)
CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  chunk_text TEXT,
  start_char INTEGER,
  end_char INTEGER,
  embedding JSONB,
  embedding_vec vector -- Requires pgvector
);

-- Create an index for fast ANN searches (use cosine/Euclidean based on queries)
-- ivfflat index; adjust 'lists' for performance (smaller = faster build, larger = better recall)
CREATE INDEX IF NOT EXISTS chunks_embedding_vec_idx ON chunks USING ivfflat (embedding_vec vector_l2_ops) WITH (lists = 100);

-- Optional: Expression index for document-filtered queries
-- CREATE INDEX IF NOT EXISTS chunks_doc_embedding_idx ON chunks (document_id, id) WHERE embedding_vec IS NOT NULL;
```

If the documents table was created without the `text` column, add it:

```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS text TEXT;
```

---

## Backend: Run Locally

From the `/backend` directory:

```bash
cd backend
npm install
```

Start the backend:

```bash
# Development mode
npm run start
# OR
node src/index.js
```

The backend runs on `http://localhost:4000` by default. Check logs for errors (e.g., DB auth issues; see Troubleshooting).

---

## Frontend: Run Locally

From the `/frontend` directory:

```bash
cd frontend
npm install
npm run dev  # or npm start (depending on setup, e.g., Vite or Create React App)
```

Open your browser at the port printed by the frontend server (typically `http://localhost:3000` or `http://localhost:5173` for Vite).

---

## API Endpoints

### `POST /api/upload`

- **Input:** Form-data with a PDF file.
- **Response:** Document object from documents table

```json
{ "id": 123, "title": "doc.pdf", "text": "...", "created_at": "2025-09-11T12:00:00Z" }
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/upload -F "file=@/path/to/doc.pdf"
```

---

### `POST /api/ingest`

- **Input:** JSON body with either `{ "document_id": 123 }` or `{ "text": "raw text..." }`.
- **Action:** Chunks text and stores embeddings in the chunks table (JSONB + vector column).
- **Response:**

```json
{ "status": "ok", "ingested": 5 }
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/ingest -H "Content-Type: application/json" -d '{"document_id": 123}'
```

---

### `POST /api/query`

- **Input:** JSON body with `{ "document_id": 123, "question": "What is..." }` or `{ "question": "..." }`.
- **Response:**

```json
{ "answer": "...", "sources": [{ "id": 1, "snippet_index": 0, "score": 0.95 }, ...] }
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/query -H "Content-Type: application/json" -d '{"question": "What is the document about?"}'
```

---

## Embeddings & LLMs: Gemini vs OpenAI

- The backend uses an embedding helper that prioritizes **Gemini** (if `GEMINI_API_KEY` is set) and falls back to **OpenAI** (if `OPENAI_API_KEY` is set). If neither is available, it uses mock embeddings.
- Set `EMBEDDING_DIM=1536` in `.env` for 1536-dimensional embeddings. The helper normalizes/truncates/pads vectors to this dimension.
- For LLM generation, the `callLLM` function tries Gemini (`GEMINI_CHAT_MODEL`), then OpenAI, and falls back to a mock answer if neither is available.

---

## Note on Gemini Scaling / MRL

When using Gemini's `gemini-embedding-001` (default 3072 dimensions) with `EMBEDDING_DIM=1536`, the backend includes normalization/truncation logic to slice/pad embeddings. For proper Matryoshka Representation Learning (MRL) scaling, refer to Google's documentation. This repo uses a pragmatic approach: request the embedding and slice/pad to `EMBEDDING_DIM`.

---
