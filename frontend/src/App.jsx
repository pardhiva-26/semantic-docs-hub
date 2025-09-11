import React, { useState } from 'react';
import Upload from './components/Upload';
import Viewer from './components/Viewer';
import QA from './components/QA';
import Container from 'react-bootstrap/Container';

export default function App() {
  // main app state
  const [document, setDocument] = useState(null); // {id, text, title, createdAt}
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-indigo-50 to-cyan-50 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-gradient-to-br from-purple-300 to-indigo-300 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-gradient-to-br from-blue-300 to-cyan-300 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <Container fluid className="min-h-screen flex flex-col relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Semantic Documents Hub
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Upload, analyze, and interact with your documents using advanced AI capabilities
          </p>
        </div>

        {/* Main grid: Upload (4) | Viewer (8) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 lg:px-12 mb-8 w-full">
          {/* Upload Section */}
          <div className="lg:col-span-4">
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-lg border border-indigo-100 p-8 flex flex-col items-center justify-center hover:shadow-2xl transition-all duration-300 hover:scale-[1.03]">
              <Upload
                document={document}
                setDocument={(doc) => {
                  setDocument(doc);
                  // reset previous QA state when new doc uploaded
                  setAnswer(null);
                  setSources([]);
                  // optional convenience global (some components read this)
                  try { window.__LAST_DOC_ID__ = doc?.id ?? null; } catch(e) {}
                }}
              />
            </div>
          </div>

          {/* Viewer Section */}
          <div className="lg:col-span-8">
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-lg border border-indigo-100 p-8 h-full hover:shadow-2xl transition-all duration-300 hover:scale-[1.03]">
              <Viewer document={document} answer={answer} sources={sources} />
            </div>
          </div>
        </div>

        {/* Q&A */}
        <div className="px-6 lg:px-12">
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-lg border border-indigo-100 p-8 hover:shadow-2xl transition-all duration-300 hover:scale-[1.03]">
            <QA
              document={document}
              setAnswer={(a) => setAnswer(a)}
              setSources={(s) => setSources(s)}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
