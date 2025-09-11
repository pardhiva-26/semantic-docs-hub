import React, { useState } from 'react';

export default function QA({ document, setAnswer: setAnswerFromParent, setSources: setSourcesFromParent }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);

  async function handleAsk(e) {
    e?.preventDefault();
    if (!document) return alert('Upload a document first');
    if (!question.trim()) return alert('Type a question');

    setLoading(true);
    setAnswer(null);
    setSources([]);

    try {
      const resp = await fetch('http://localhost:4000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: document.id, question })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Query failed');

      // local UI
      setAnswer(data.answer || data);
      setSources(data.sources || []);

      // also bubble up to parent if provided
      if (typeof setAnswerFromParent === 'function') {
        try { setAnswerFromParent(data.answer || data); } catch (e) { /* ignore */ }
      }
      if (typeof setSourcesFromParent === 'function') {
        try { setSourcesFromParent(data.sources || []); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error(err);
      alert('Query failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-xl font-semibold text-gray-800 mb-2">Ask a Question</h4>

      <form onSubmit={handleAsk}>
        <div className="relative">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g., What is the main contribution?"
            className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 resize-none"
            rows="3"
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={!document || loading}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              document ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>

          <div className="text-sm text-gray-500">
            {document ? '' : 'Upload a document to enable asking.'}
          </div>
        </div>
      </form>

      {answer && (
        <div className="mt-4 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
          <div className="font-medium text-gray-800 mb-2">Answer</div>
          <div className="text-gray-700 whitespace-pre-wrap">{answer}</div>

          {sources && sources.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              <div className="font-semibold">Sources</div>
              <ul className="list-disc pl-5 mt-1">
                {sources.map((s, i) => (
                  <li key={i}>
                    Snippet #{s.snippet_index ?? i + 1} (score: {Number(s.score || 0).toFixed(3)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
