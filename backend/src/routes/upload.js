import express from 'express';
import multer from 'multer';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { query } from '../db.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/upload (form-data: file)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });

    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);

    console.log('uploaded file', req.file);
      console.log('pdf text length:', data.text.length);


    // insert doc into Postgres
    const insertDoc = await query(
      `INSERT INTO documents (title, text) VALUES ($1, $2) RETURNING *`,
      [req.file.originalname || `doc-${Date.now()}`, data.text || '']
    );

    const doc = insertDoc.rows[0];

    // cleanup tmp file
    try { fs.unlinkSync(req.file.path); } catch (e) { console.warn('cleanup failed', e); }

    return res.json(doc);
  } catch (err) {
    console.error('upload error', err);
    //  console.error('upload error', err); 
    return res.status(500).json({ error: 'upload failed', details: String(err) });
  }
});

export default router;
