// backend/src/index.js
import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.js';
import ingestRouter from './routes/ingest.js';
import queryRouter from './routes/query.js';
import dotenv from "dotenv";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());
// console.log("PORT from .env:", process.env.PORT);
// console.log("DATABASE_URL from .env:", process.env.DATABASE_URL);

// route mounting
app.use('/api/upload', uploadRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/query', queryRouter);

// optional quick health route
app.get('/', (req, res) => res.send('Backend running - semantic hub'));

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
