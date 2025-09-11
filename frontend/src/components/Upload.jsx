// frontend/src/components/Upload.jsx
// NOTE: Uses Tailwind utility classes (as in your provided CSS).
// If you don't have Tailwind installed in your Vite app, let me convert to Bootstrap classes.

import React, { useState } from 'react';

export default function Upload({ document,setDocument }) {
  const [file, setFile] = useState(null);
  // const [document, set] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return alert('Choose a PDF first');

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

      const resp = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: fd
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Upload failed');
      setDocument(data);
      setIngestResult(null);
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleIngest() {
  if (!document) return alert("Upload a document first!");
  const docId = document.id;
  if (!docId) return alert("No document to ingest");

  setIngesting(true);
  try {
    const resp = await fetch("http://localhost:4000/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: docId }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || "Ingest failed");
    setIngestResult(data);
    alert(`Ingested ${data.ingested || 0} chunks`);
  } catch (err) {
    console.error(err);
    alert("Ingest failed: " + err.message);
  } finally {
    setIngesting(false);
  }
}

  // tries to get the current document id from parent via setDocument? (we don't have direct access)
  // Keep simple: ask backend for last uploaded doc via frontend state (we stored it in parent via setDocument).
  // So this helper expects the parent to have setDocument -> but we can't access it here.
  // We'll rely on the parent to call ingest by clicking the Ingest button after upload.
  async function getCurrentDocId() {
    // This component cannot read parent's state directly.
    // The parent (App) keeps the doc in its state and will render this component with setDocument only.
    // To keep UX simple, attempt to read last uploaded doc by calling a backend endpoint is optional.
    // For now, ingest will rely on the parent calling ingest with the doc's id or user clicking Ingest after upload.
    // We'll attempt to read `window.__LAST_DOC__` if the parent sets it for convenience (see App usage).
    // If not present, ask the user to use the Ingest button after Upload completes.
    return window.__LAST_DOC_ID__ || null;
  }

  // keep file name display text
  const fileName = file ? file.name : 'No file chosen';

  return (
    <div className="space-y-6">
      <h4 className="text-xl font-semibold text-gray-800 mb-4">Upload PDF</h4>

      <form onSubmit={handleUpload} className="border-2 border-dashed border-indigo-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors duration-200">
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <label className="cursor-pointer block">
            <span className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200">
              Choose File
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <p className="text-gray-500 mt-2">{fileName}</p>

          <div className="flex gap-2 justify-center">
            <button type="submit" disabled={uploading} className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${uploading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>

            <button
              type="button"
              disabled={ingesting}
              onClick={handleIngest}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${ingesting ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              {ingesting ? 'Ingesting...' : 'Ingest'}
            </button>
          </div>

          {ingestResult && (
            <div className="text-sm text-gray-600">
              Ingested: <strong>{ingestResult.ingested}</strong> chunks
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
