import React, { useState, useEffect, useRef } from 'react';
import { extractTextFromPDF } from './lib/pdf';
import { generatePresentationSummary, askDocumentQuestion, generateQuiz } from './lib/ai';
import { FileUp, Sparkles, ChevronLeft, ChevronRight, KeyRound, Presentation, Download, Plus, History, MessageCircle, X, Send, Volume2, VolumeX, Trash2, PlayCircle, PauseCircle, Maximize, Minimize, Edit2, Check, Copy, Mic, MicOff, AlignLeft, BrainCircuit, Share2, HelpCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import pptxgen from "pptxgenjs";
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function App() {
  const [appStarted, setAppStarted] = useState(false);
  const [apiKey, setApiKey] = useState('AIzaSyDFiE4PCESo0sE8JYA_azpJUO6O5PpO5wo');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [error, setError] = useState('');

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('deckify_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeDeckId, setActiveDeckId] = useState(null);

  // Chatbot states
  const [rawText, setRawText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatting, setIsChatting] = useState(false);

  // New Features States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  
  const presentationRef = useRef(null);
  const recognitionRef = useRef(null);

  const [isListening, setIsListening] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Quiz States
  const [quiz, setQuiz] = useState(null);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  useEffect(() => {
    // Setup Voice Control
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.toLowerCase().trim();
        
        if (transcript.includes('next') || transcript.includes('forward') || transcript.includes('skip')) {
          setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
        } else if (transcript.includes('back') || transcript.includes('previous') || transcript.includes('last')) {
          setCurrentSlideIndex(prev => Math.max(0, prev - 1));
        }
      };

      recognition.onend = () => {
        if (isListening) recognition.start(); // auto restart if it drops natively
      };

      recognitionRef.current = recognition;
    }
  }, [slides.length]);
  
  // Update recognition state securely
  useEffect(() => {
    if (recognitionRef.current) {
      if (isListening) {
        try { recognitionRef.current.start(); } catch(e){}
      } else {
        recognitionRef.current.stop();
      }
    }
  }, [isListening]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError('Please provide a Google Gemini API Key');
      return;
    }
    if (!file) {
      setError('Please upload a PDF file');
      return;
    }

    setLoading(true);
    setError('');
    setSlides([]);
    setCurrentSlideIndex(0);

    try {
      const text = await extractTextFromPDF(file);
      setRawText(text);
      const generatedSlides = await generatePresentationSummary(text, apiKey);
      
      const newDeck = {
        id: Date.now().toString(),
        filename: file.name,
        date: new Date().toLocaleDateString(),
        slides: generatedSlides,
        rawText: text
      };

      setSlides(generatedSlides);
      setActiveDeckId(newDeck.id);
      
      setHistory(prev => {
        const updated = [newDeck, ...prev];
        localStorage.setItem('deckify_history', JSON.stringify(updated));
        return updated;
      });
      
    } catch (err) {
      console.error(err);
      setError(`Error: ${err.message || 'Unknown error. Check console.'}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryItem = (e, id) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('deckify_history', JSON.stringify(updated));
    if (activeDeckId === id) {
      setSlides([]);
      setActiveDeckId(null);
      setRawText('');
      setChatMessages([]);
    }
  };

  const startRenaming = (e, item) => {
    e.stopPropagation();
    setRenamingId(item.id);
    setRenameText(item.filename);
  };

  const commitRename = (e, id) => {
    e.stopPropagation();
    const updated = history.map(item => item.id === id ? { ...item, filename: renameText } : item);
    setHistory(updated);
    localStorage.setItem('deckify_history', JSON.stringify(updated));
    setRenamingId(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (presentationRef.current) {
        presentationRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const copySlideContent = () => {
    const slide = slides[currentSlideIndex];
    if (!slide) return;
    const text = `${slide.title}\n\n${slide.bulletPoints.map(p => `• ${p}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(currentSlideIndex);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sharePresentation = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: file?.name ? `Deckify Presentation: ${file.name}` : 'My Deckify AI Deck',
          text: `Check out this presentation deck, entirely built via AI parsing of a document with ${slides.length} slides!`
        });
      } catch (err) { }
    } else {
      alert("Native social sharing is not supported securely on this browser endpoint.");
    }
  };

  const handleGenerateQuiz = async () => {
    if (!rawText) return;
    setQuizLoading(true);
    setIsQuizMode(true);
    try {
      const generated = await generateQuiz(rawText, apiKey);
      setQuiz(generated);
      setQuizAnswers({});
      setQuizSubmitted(false);
    } catch (err) {
      alert("Failed to generate quiz. Please try again.");
      setIsQuizMode(false);
    } finally {
      setQuizLoading(false);
    }
  };

  const updateSlideTitle = (newVal) => {
    setSlides(prev => prev.map((s, i) => i === currentSlideIndex ? { ...s, title: newVal } : s));
  };

  const updateSlideBullet = (idx, newVal) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== currentSlideIndex) return s;
      const bullets = [...s.bulletPoints]; 
      bullets[idx] = newVal;
      return { ...s, bulletPoints: bullets };
    }));
  };

  const nextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (chatOpen) return; // Ignore if chatting
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, chatOpen]);

  // Autoplay functionality
  useEffect(() => {
    let interval;
    if (isAutoPlaying && slides.length > 0) {
      if (currentSlideIndex === slides.length - 1) {
        setIsAutoPlaying(false);
      } else {
        interval = setInterval(() => {
          setCurrentSlideIndex(prev => prev + 1);
        }, 4000);
      }
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, currentSlideIndex, slides.length]);

  // Text to Speech
  const toggleSpeech = () => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const slide = slides[currentSlideIndex];
      const text = `${slide.title}. ${slide.bulletPoints.join(". ")}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Cancel speech on slide change
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [currentSlideIndex, activeDeckId]);

  const handleChatSend = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !rawText || isChatting) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      const response = await askDocumentQuestion(rawText, userMsg, apiKey);
      setChatMessages(prev => [...prev, { role: 'bot', text: response }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'bot', text: 'Error: Could not fetch answer. Please check your API key.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const drawPageBackground = () => {
      // Dark Base Background
      doc.setFillColor(15, 15, 20); 
      doc.rect(0, 0, 210, 297, 'F');
      
      // Vibrant Header Bar
      doc.setFillColor(139, 92, 246);
      doc.rect(0, 0, 210, 25, 'F');
    };

    drawPageBackground();

    // Document Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text("Deckify Detailed Report", 15, 17);

    // Meta Date
    doc.setTextColor(240, 240, 240);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 160, 16);

    let yPos = 40;

    slides.forEach((slide, index) => {
      // Check if title fits on page
      if (yPos > 260) {
        doc.addPage();
        drawPageBackground();
        yPos = 40;
      }

      // Section Title
      doc.setTextColor(167, 139, 250); // Light purple for headings
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      
      const titleLines = doc.splitTextToSize(`${index + 1}. ${slide.title}`, 180);
      doc.text(titleLines, 15, yPos);
      yPos += titleLines.length * 7 + 4;
      
      // Points
      doc.setFont('helvetica', 'normal');
      
      slide.bulletPoints.forEach((point) => {
        // Bullet pagination check
        if (yPos > 275) {
          doc.addPage();
          drawPageBackground();
          yPos = 40;
        }

        // Circular bullet
        doc.setFillColor(16, 185, 129); // Green
        doc.circle(20, yPos - 1.5, 1.5, 'F');
        
        doc.setTextColor(220, 220, 225);
        doc.setFontSize(12);
        const lines = doc.splitTextToSize(point, 165);
        doc.text(lines, 26, yPos);
        
        yPos += lines.length * 6 + 4; 
      });
      
      // Print the comprehensive detailed synthesis
      if (slide.detailedContent) {
        yPos += 3;
        doc.setTextColor(170, 170, 180);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        const detailedLines = doc.splitTextToSize(slide.detailedContent, 180);
        
        // Prevent detailed block overflow
        if (yPos + (detailedLines.length * 5.5) > 275) {
          doc.addPage();
          drawPageBackground();
          yPos = 40;
        }

        doc.text(detailedLines, 15, yPos);
        yPos += detailedLines.length * 5.5 + 4;
      }
      
      // Gap between sections
      yPos += 8;
    });

    // 7. Footer across all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      doc.setDrawColor(50, 50, 60);
      doc.line(15, 282, 195, 282);

      doc.setTextColor(120, 120, 130);
      doc.setFontSize(10);
      doc.text("Deckify Agentic AI \u2022 Detailed Summary", 15, 288);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(139, 92, 246);
      doc.text(`Page ${i} / ${pageCount}`, 180, 288);
    }

    doc.save('Deckify_Detailed_Report.pdf');
  };

  const exportPPTX = () => {
    let pres = new pptxgen();

    pres.layout = "LAYOUT_16x9";

    slides.forEach((slide) => {
      let pptxSlide = pres.addSlide();

      // Background
      pptxSlide.background = { color: "131318" }; 
      
      // Header Bar
      pptxSlide.addShape(pres.ShapeType.rect, { 
        x: 0, y: 0, w: "100%", h: 0.8, fill: { color: "8b5cf6" } 
      });

      // Title
      pptxSlide.addText(slide.title, {
        x: 0.5, y: 0.15, w: "90%", h: 0.5,
        fontSize: 32, color: "FFFFFF", bold: true, fontFace: "Helvetica"
      });

      // Bullets
      let bullets = slide.bulletPoints.map(point => ({ text: point, options: { bullet: { code: '2022' } } }));
      
      pptxSlide.addText(bullets, {
        x: 0.5, y: 1.2, w: "90%", h: "80%",
        fontSize: 18, color: "E0E0E0", valign: "top", fontFace: "Helvetica",
        bullet: { color: "10b981" },
        lineSpacing: 18,
        margin: [0, 0, 10, 0]
      });
      
      // Footer
      pptxSlide.addText("Deckify Agentic AI \u2022 Automatically Synthesized Document", { 
        x: 0.5, y: 5.2, w: "50%", h: 0.3, fontSize: 10, color: "888888" 
      });
    });

    pres.writeFile({ fileName: "Deckify_Presentation.pptx" });
  };


  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  if (!appStarted) {
    return (
      <div className="landing-container">
        <div className="landing-bg-orb-1"></div>
        <div className="landing-bg-orb-2"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ zIndex: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <Presentation size={60} color="#8b5cf6" style={{ filter: 'drop-shadow(0px 0px 15px rgba(139, 92, 246, 0.5))' }} />
          </div>
          <h1 className="hero-title">Presentations, Solved.</h1>
          <p className="hero-subtitle">
            Upload any dense PDF right into the browser and instantly synthesize it into a premium presentation-ready slide deck—packed with virtual teleprompters, voice navigation, and completely interactive document chatbot capabilities.
          </p>
          <button className="start-btn" onClick={() => setAppStarted(true)}>
            Enter Workspace <ChevronRight size={20} />
          </button>
        </motion.div>

        <motion.div 
          className="feature-grid"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ zIndex: 10 }}
        >
          <div className="feature-card">
            <div className="feature-icon-wrapper"><BrainCircuit size={24} /></div>
            <h3>Deep Agentic Extraction</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>Our local context handles parsing dense texts near-instantly, cleverly creating concise bullet point punchlines alongside massive teleprompter scripts.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrapper"><MessageCircle size={24} /></div>
            <h3>Contextual Chatbot</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>Forgot a specific PDF metric? Just ask the sidebar AI. The embedded Q&A bot pulls exact context right from your raw document on the fly.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrapper"><Download size={24} /></div>
            <h3>Universal Native Overlays</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>Export out flawlessly directly offline. Output beautiful endless A4 PDF Reports, or native 16x9 Microsoft PowerPoint files keeping the visual data attached.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-title">
          <Presentation size={32} color="#8b5cf6" />
          <span>Deckify</span>
        </div>
        
        <button 
          className="btn" 
          onClick={() => { setSlides([]); setFile(null); setActiveDeckId(null); setError(''); setRawText(''); setChatMessages([]); setChatOpen(false); }}
          style={{ padding: '0.75rem', fontSize: '1rem', marginBottom: '1rem' }}
        >
          <Plus size={18} /> New Deck
        </button>

        <div className="history-list">
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={16} /> Recent History
          </div>
          
          {history.map(item => (
            <div 
              key={item.id}
              className={`history-item ${activeDeckId === item.id ? 'active' : ''}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => {
                if (renamingId === item.id) return;
                setSlides(item.slides);
                setActiveDeckId(item.id);
                setCurrentSlideIndex(0);
                setError('');
                setRawText(item.rawText || '');
                setChatMessages([]);
              }}
            >
              {renamingId === item.id ? (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                  <input 
                    value={renameText} 
                    onChange={e => setRenameText(e.target.value)} 
                    style={{ flex: 1, background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid var(--accent-primary)', outline: 'none', borderRadius: '4px', padding: '0.4rem' }} 
                    onKeyDown={e => e.key === 'Enter' && commitRename(e, item.id)} 
                    autoFocus 
                  />
                  <button onClick={(e) => commitRename(e, item.id)} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '0.2rem' }}>
                    <Check size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ overflow: 'hidden' }}>
                    <div className="history-item-title">{item.filename}</div>
                    <div className="history-item-date">{item.date} • {item.slides.length} slides</div>
                  </div>
                  <div style={{ display: 'flex' }}>
                    <button 
                      onClick={(e) => startRenaming(e, item)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.8, padding: '0.4rem' }}
                      title="Rename Deck"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => deleteHistoryItem(e, item.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', opacity: 0.8, padding: '0.4rem' }}
                      title="Delete from history"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {history.length === 0 && (
             <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>No history yet</div>
          )}
        </div>
      </aside>

      <div className="dashboard-main">
        <div className="app-container">
          <main className="main-content">
        {!loading && slides.length === 0 && (
          <motion.div 
            className="upload-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="upload-icon-container">
              <FileUp size={40} />
            </div>
            <h1 className="upload-title">PDF to Presentable Slides</h1>
            <p className="upload-subtitle">Powered by Agentic AI. Upload a document to synthesize its core ideas into a clean deck.</p>
            
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <KeyRound size={20} color="#a1a1aa" style={{ position: 'absolute', top: '15px', left: '15px' }} />
              <input 
                type="password" 
                className="apikey-input" 
                placeholder="Google Gemini API Key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ paddingLeft: '45px', marginBottom: 0 }}
              />
            </div>

            <div className="file-input-wrapper" style={{ position: 'relative' }}>
              <div 
                style={{ 
                  border: '2px dashed var(--card-border)', 
                  borderRadius: '12px', 
                  padding: '2rem', 
                  marginBottom: '1.5rem',
                  background: file ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  borderColor: file ? 'var(--success)' : 'var(--card-border)',
                  transition: 'all 0.3s'
                }}
              >
                {file ? (
                  <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{file.name}</span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>Click to upload PDF or drag & drop</span>
                )}
              </div>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handleFileChange} 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
            </div>

            {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', fontWeight: '500' }}>{error}</div>}

            <button className="btn" onClick={handleGenerate} disabled={!file || !apiKey}>
              <Sparkles size={20} /> Generate Presentation
            </button>
          </motion.div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <div className="loader-text">AI is reading document and generating presentation...</div>
          </div>
        )}

        {slides.length > 0 && !loading && !isQuizMode && (
          <motion.div 
            ref={presentationRef}
            className="presentation-container"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={isFullscreen ? {
              height: '100vh', width: '100vw', maxWidth: 'none', margin: 0, borderRadius: 0, border: 'none', display: 'flex', flexDirection: 'column'
            } : {}}
          >
            <div className="slide-content">
              <span className="slide-number">{currentSlideIndex + 1} / {slides.length}</span>
              
              <AnimatePresence mode='wait' custom={1}>
                <motion.div
                  key={currentSlideIndex}
                  custom={1}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                >
                  <h2 className="slide-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ marginRight: '1rem' }}>{slides[currentSlideIndex].emoji}</span>
                    {isEditMode ? (
                      <input 
                        value={slides[currentSlideIndex].title} 
                        onChange={e => updateSlideTitle(e.target.value)} 
                        style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--accent-primary)', fontSize: 'inherit', fontWeight: 'inherit', flex: 1, padding: '0.2rem', borderRadius: '8px' }}
                      />
                    ) : (
                      <span>{slides[currentSlideIndex].title}</span>
                    )}
                    
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isEditMode ? 'var(--success)' : 'var(--text-secondary)' }}
                        title="Edit Slide Content"
                      >
                        <Edit2 size={24} />
                      </button>
                      <button 
                        onClick={copySlideContent}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedIndex === currentSlideIndex ? 'var(--success)' : 'var(--text-secondary)' }}
                        title="Copy slide points to clipboard"
                      >
                        {copiedIndex === currentSlideIndex ? <Check size={24} /> : <Copy size={24} />}
                      </button>
                      <button 
                        onClick={toggleSpeech}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSpeaking ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                        title="Read slide aloud"
                      >
                        {isSpeaking ? <VolumeX size={24} /> : <Volume2 size={24} />}
                      </button>
                    </div>
                  </h2>
                  <ul className="slide-bullets">
                    {slides[currentSlideIndex].bulletPoints.map((point, idx) => (
                      <motion.li 
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + (idx * 0.15) }}
                      >
                        {isEditMode ? (
                          <textarea 
                            value={point} 
                            onChange={e => updateSlideBullet(idx, e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--accent-primary)', fontSize: 'inherit', width: '100%', padding: '0.5rem', borderRadius: '8px', minHeight: '60px', fontFamily: 'inherit' }}
                          />
                        ) : (
                          point
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
            
            <div className="slide-controls">
              <button 
                className="control-btn" 
                onClick={prevSlide} 
                disabled={currentSlideIndex === 0}
              >
                <ChevronLeft size={24} />
              </button>
              
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={toggleFullscreen}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Toggle Presenter Mode"
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  <span style={{ fontSize: '0.85rem' }}>{isFullscreen ? 'Exit Full Screen' : 'Presenter Mode'}</span>
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--card-border)' }}></div>

                <button 
                  onClick={() => {
                    if (!recognitionRef.current) alert("Speech Recognition not supported in this browser.");
                    else setIsListening(!isListening);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isListening ? 'var(--error)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Control slides with voice"
                >
                  {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                  <span style={{ fontSize: '0.85rem' }}>Voice Commands</span>
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--card-border)' }}></div>

                <button 
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isAutoPlaying ? 'var(--accent-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Toggle Autoplay (4s delay)"
                >
                  {isAutoPlaying ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
                  <span style={{ fontSize: '0.85rem' }}>Autoplay</span>
                </button>
                
                <div style={{ width: '1px', height: '20px', background: 'var(--card-border)' }}></div>

                <button 
                  onClick={() => setShowNotes(!showNotes)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: showNotes ? 'var(--accent-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Show Presenter Notes"
                >
                  <AlignLeft size={20} />
                  <span style={{ fontSize: '0.85rem' }}>Speaker Notes</span>
                </button>
              </div>
              
              <button 
                className="control-btn" 
                onClick={nextSlide} 
                disabled={currentSlideIndex === slides.length - 1}
              >
                <ChevronRight size={24} />
              </button>
            </div>
            
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
              ></div>
            </div>

            {/* Dynamic Speaker Notes Panel */}
            <AnimatePresence>
              {showNotes && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', marginTop: '1.5rem', textAlign: 'left', overflow: 'hidden' }}
                >
                  <h3 style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} /> Virtual Teleprompter
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                    {slides[currentSlideIndex].detailedContent || "No expansive detailed content available for this slide."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', gap: '1rem' }}>
              <button 
                className="btn" 
                onClick={exportPDF} 
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  background: 'rgba(139, 92, 246, 0.1)', 
                  border: '1px solid var(--accent-primary)', 
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  width: 'auto'
                }}
              >
                <Download size={18} style={{ marginRight: '0.5rem' }} /> Export to Detailed PDF
              </button>
              
              <button 
                className="btn" 
                onClick={exportPPTX} 
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  border: '1px solid var(--success)', 
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  width: 'auto'
                }}
              >
                <Download size={18} style={{ marginRight: '0.5rem' }} /> Export to PPTX
              </button>

              <button 
                className="btn" 
                onClick={sharePresentation} 
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  background: 'rgba(59, 130, 246, 0.1)', 
                  border: '1px solid #3b82f6', 
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  width: 'auto'
                }}
              >
                <Share2 size={18} style={{ marginRight: '0.5rem' }} /> Share Match
              </button>
              <button 
                className="btn" 
                onClick={handleGenerateQuiz} 
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  background: 'rgba(236, 72, 153, 0.1)', 
                  border: '1px solid #ec4899', 
                  color: '#ec4899',
                  display: 'flex',
                  alignItems: 'center',
                  width: 'auto'
                }}
              >
                <HelpCircle size={18} style={{ marginRight: '0.5rem' }} /> Test Knowledge
              </button>
            </div>
          </motion.div>
        )}

        {isQuizMode && (
          <motion.div 
            className="presentation-container"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BrainCircuit color="var(--accent-primary)" /> Generate Quiz Mode
              </h2>
              <button 
                onClick={() => setIsQuizMode(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {quizLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <div className="loader-text">AI is reading document and generating questions...</div>
              </div>
            ) : quiz ? (
              <div>
                {quiz.map((q, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '1rem', color: 'white' }}>{i + 1}. {q.question}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {q.options.map((opt, oIdx) => {
                        const isSelected = quizAnswers[i] === oIdx;
                        const isCorrect = q.answerIndex === oIdx;
                        
                        let bg = 'rgba(255,255,255,0.05)';
                        let border = '1px solid var(--card-border)';
                        
                        if (quizSubmitted) {
                          if (isCorrect) {
                            bg = 'rgba(16, 185, 129, 0.2)'; border = '1px solid var(--success)';
                          } else if (isSelected && !isCorrect) {
                            bg = 'rgba(239, 68, 68, 0.2)'; border = '1px solid var(--error)';
                          }
                        } else if (isSelected) {
                          bg = 'rgba(139, 92, 246, 0.3)'; border = '1px solid var(--accent-primary)';
                        }

                        return (
                          <div 
                            key={oIdx}
                            onClick={() => !quizSubmitted && setQuizAnswers(prev => ({ ...prev, [i]: oIdx }))}
                            style={{ padding: '0.8rem 1rem', background: bg, border: border, borderRadius: '8px', cursor: quizSubmitted ? 'default' : 'pointer', transition: 'all 0.2s' }}
                          >
                            {opt}
                          </div>
                        )
                      })}
                    </div>
                    {quizSubmitted && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderLeft: '4px solid var(--accent-primary)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <strong>Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
                
                <button 
                  className="btn" 
                  onClick={() => setQuizSubmitted(true)}
                  disabled={quizSubmitted || Object.keys(quizAnswers).length < quiz.length}
                  style={{ width: '100%', marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}
                >
                  {quizSubmitted ? `Score: ${Object.keys(quizAnswers).filter(k => quizAnswers[k] === quiz[k].answerIndex).length} / ${quiz.length}` : 'Submit Answers'}
                </button>
              </div>
            ) : null}
          </motion.div>
        )}
      </main>
        </div>
      </div>

      {/* Floating Chat Widget */}
      {slides.length > 0 && rawText && (
        <div className="chat-widget">
          <AnimatePresence>
            {chatOpen && (
              <motion.div 
                className="chat-window"
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="chat-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={18} color="var(--accent-primary)" />
                    <span>Document Q&A Chat</span>
                  </div>
                  <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                
                <div className="chat-body" id="chat-body">
                  {chatMessages.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }}>
                      Ask me any specific question about the document data!
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`chat-message ${msg.role}`}>
                        {msg.role === 'bot' ? (
                          <div className="markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    ))
                  )}
                  {isChatting && (
                    <div className="chat-message bot" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                      Thinking...
                    </div>
                  )}
                </div>

                <form className="chat-input-area" onSubmit={handleChatSend}>
                  <input 
                    type="text" 
                    className="chat-input"
                    placeholder="Ask a question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isChatting}
                  />
                  <button type="submit" className="chat-send" disabled={isChatting || !chatInput.trim()}>
                    <Send size={18} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {!chatOpen && (
            <motion.button 
              className="chat-btn"
              onClick={() => setChatOpen(true)}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MessageCircle size={28} />
            </motion.button>
          )}
        </div>
      )}

    </div>
  );
}

export default App;
