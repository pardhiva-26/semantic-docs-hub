import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function Viewer({ document, sources = [], answer = null }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);
  const refs = useRef({});
  const [flashKey, setFlashKey] = useState(null);

  const ranges = useMemo(() => {
    if (!Array.isArray(sources) || !sources.length || !document?.text) return [];
    const raw = sources
      .map(s => ({
        start: Number(s.start_char ?? s.start ?? 0),
        end: Number(s.end_char ?? s.end ?? 0),
        snippet_index: s.snippet_index ?? null,
        id: s.id ?? null,
        score: s.score ?? 0
      }))
      .filter(r => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
      .sort((a, b) => a.start - b.start);

    const merged = [];
    for (const r of raw) {
      const last = merged[merged.length - 1];
      if (!last || r.start > last.end) {
        merged.push({ ...r, indices: [r.snippet_index] });
      } else {
        last.end = Math.max(last.end, r.end);
        last.indices = Array.from(new Set([...(last.indices || []), r.snippet_index]));
      }
    }
    return merged;
  }, [sources, document?.text]);

  const fragments = useMemo(() => {
    const text = document?.text || '';
    if (!ranges.length) return [{ text, highlight: false }];
    const out = [];
    let cursor = 0;
    for (const r of ranges) {
      if (cursor < r.start) out.push({ text: text.slice(cursor, r.start), highlight: false });
      out.push({ text: text.slice(r.start, r.end), highlight: true, meta: r });
      cursor = r.end;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), highlight: false });
    return out;
  }, [document?.text, ranges]);

  useEffect(() => {
    if (!ranges.length) return;
    const first = ranges[0];
    const key = `h-${first.start}-${first.end}`;
    const el = refs.current[key];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-amber-300');
      setTimeout(() => el.classList.remove('ring-4', 'ring-amber-300'), 1200);
      setFlashKey(key);
      setTimeout(() => setFlashKey(null), 1500);
    }
  }, [JSON.stringify(sources || []), ranges]);

  function handleClickSnippet(idxSource) {
    if (!idxSource) return;
    const start = Number(idxSource.start_char ?? idxSource.start ?? 0);
    const end = Number(idxSource.end_char ?? idxSource.end ?? 0);
    const key = `h-${start}-${end}`;
    const el = refs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-amber-300');
      setTimeout(() => el.classList.remove('ring-4', 'ring-amber-300'), 1200);
      setFlashKey(key);
      setTimeout(() => setFlashKey(null), 1500);
    }
  }

  if (!document) {
    return (
      <div className="space-y-4">
        <h4 className="text-xl font-semibold text-gray-800 mb-4">Document Viewer</h4>
        <div className="h-80 bg-gray-50 rounded-lg border-2 border-gray-200 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">Select or upload a document to view</p>
          </div>
        </div>
      </div>
    );
  }

  const preview = document.text ? document.text.slice(0, 3000) : '[no text found]';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h4 className="text-xl font-semibold text-gray-800">{document.title || 'Document'}</h4>
        <div className="text-sm text-gray-500">{new Date(document.createdAt || Date.now()).toLocaleString()}</div>
      </div>

      {answer && (
        <div className="mb-2 p-3 bg-indigo-50 rounded-md border border-indigo-100">
          <div className="font-medium text-gray-800">Answer</div>
          <div className="text-gray-700 text-sm mt-1 whitespace-pre-wrap">{answer}</div>
        </div>
      )}

      <div ref={containerRef} className="bg-gray-50 rounded-lg border-2 border-gray-200 p-4 max-h-[460px] overflow-auto whitespace-pre-wrap prose" style={{ lineHeight: 1.5 }}>
        {
          fragments.map((f, idx) => {
            if (!f.highlight) {
              return <span key={`f-${idx}`}>{f.text}</span>;
            }
            const k = `h-${f.meta.start}-${f.meta.end}`;
            return (
              <span
                key={k}
                ref={(el) => (refs.current[k] = el)}
                tabIndex={-1}
                className={`rounded px-1 py-[1px] shadow-sm ${flashKey === k ? 'ring-4 ring-amber-300' : 'bg-yellow-100'}`}
                data-start={f.meta.start}
                data-end={f.meta.end}
                style={{ display: 'inline-block' }}
              >
                {f.text}
              </span>
            );
          })
        }
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">
          {expanded ? 'Show Less' : 'Show More'}
        </button>

        <div className="ml-auto text-sm text-gray-600">
          {Array.isArray(sources) && sources.length ? (
            <div className="flex gap-2 items-center">
              <div className="font-semibold text-gray-700">Top snippets:</div>
              <div className="flex gap-1">
                {sources.map((s, i) => (
                  <button
                    key={`src-${i}`}
                    onClick={() => handleClickSnippet(s)}
                    className="px-2 py-1 rounded-md bg-white border text-xs hover:bg-indigo-50 transition"
                    title={`Snippet ${s.snippet_index ?? i + 1}`}
                  >
                    #{s.snippet_index ?? i + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-400">No snippets highlighted</div>
          )}
        </div>
      </div>
    </div>
  );
}
