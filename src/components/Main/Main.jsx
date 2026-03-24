import React, { useState, useRef, useEffect } from "react";
import "./Main.css";
// CHANGED: Replaced custom formatText with react-markdown for robust markdown support
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import runChat, { uploadPdfs, ragChat } from "../../config/geminiClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGraduationCap, faBrain, faCubes, faNewspaper } from "@fortawesome/free-solid-svg-icons";
import { User, Send, Menu, FileUp, FileText } from "lucide-react";
import { UserButton, useUser } from "@clerk/react";

// CHANGED: Receive chatMode to identify Feynman sessions
const Main = ({ messages = [], chatMode = "standard", onMessagesChange, onMenuClick, onNewChat }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ragMode, setRagMode] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  /* Track whether any PDFs have been uploaded in this session */
  const [hasUploadedDocs, setHasUploadedDocs] = useState(false);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // CHANGED: Floating tooltip state for no-docs toggle warning
  const [showTooltip, setShowTooltip] = useState(false);
  
  // CHANGED: Determine if we are exactly in the Feynman listening phase
  // (We are listening if the last AI message was the Feynman prompt response)
  const isFeynmanListening = chatMode === "feynman" && 
    messages.length > 0 && 
    messages[messages.length - 1].role === "ai" &&
    messages[messages.length - 1].text.includes("validate your understanding");

  // CHANGED: Auto-trigger /feymantechnique ONLY on pristine Feynman sessions
  useEffect(() => {
    // If it's a feynman session and there are zero messages, auto-send the trigger
    if (chatMode === "feynman" && messages.length === 0 && !loading) {
      const triggerFeynman = async () => {
        setLoading(true);
        // We pretend the user typed this and immediately trigger ragChat
        const fakeMessage = { role: "user", text: "/feymantechnique" };
        onMessagesChange([fakeMessage]);
        try {
          // Force RAG mode, passing "feynman"
          const aiResponse = await ragChat("/feymantechnique", "feynman");
          onMessagesChange([fakeMessage, { role: "ai", text: aiResponse }]);
        } catch (err) {
          setError("Failed to initialize Feynman mode.");
        } finally {
          setLoading(false);
        }
      };
      // Short delay to let UI mount
      setTimeout(triggerFeynman, 300);
    }
  }, [chatMode, messages.length, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "24px";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handlePdfUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadStatus("Uploading & processing PDFs...");
    setError("");

    try {
      const result = await uploadPdfs(files);
      if (result.error) {
        setError(result.error);
        setUploadStatus("");
      } else {
        setUploadStatus(`✅ ${result.chunks_added} chunks indexed. RAG mode enabled.`);
        setRagMode(true);
        setHasUploadedDocs(true);
        const pdfNames = files.map(f => f.name).join(", ");
        onMessagesChange([...messages, { role: "ai", text: `📄 Uploaded & processed: **${pdfNames}**. You can now ask questions about these documents.` }]);
      }
    } catch (err) {
      setError("PDF upload failed: " + err.message);
      setUploadStatus("");
    }
    // Clear the input so the same file can be re-uploaded
    e.target.value = "";
  };

  // CHANGED: Handle standalone RAG toggle click
  const handleToggleRag = () => {
    if (chatMode === "feynman") return; // Locked in Feynman mode
    
    if (!ragMode && !hasUploadedDocs) {
      // Toggle ON but no docs -> show soft warning tooltip for 3s
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
    }
    setRagMode(!ragMode);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", text }];
    onMessagesChange(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      let aiResponse;
      // CHANGED: Feynman mode ALWAYS uses RAG, explicitly setting mode="feynman"
      if (chatMode === "feynman") {
        aiResponse = await ragChat(text, "feynman");
      } else if (ragMode) {
        aiResponse = await ragChat(text, "standard");
      } else {
        aiResponse = await runChat(newMessages);
      }
      onMessagesChange([...newMessages, { role: "ai", text: aiResponse }]);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const { user } = useUser();
  const showWelcome = messages.length === 0 && !loading;

  return (
    <div className="main">
      <div className="nav">
        <div className="nav-left">
          <button className="nav-menu-btn" onClick={onMenuClick}>
            <Menu size={28} strokeWidth={1.5} />
          </button>
          <p onClick={onNewChat} style={{ cursor: 'pointer', fontSize: '30px', fontWeight: '600' }}>YouLearn</p>
        </div>
        <div className="nav-right">
          <div className="user-icon">
            <UserButton />
          </div>
        </div>
      </div>

      <div className="main-container">
        {showWelcome ? (
          <div className="welcome">
            <div className="greet">
              <p><span>Hello, {user?.firstName || "User"}</span></p>
              <p>How can I help you today?</p>
            </div>
          </div>
        ) : (
          <div className="chat-history">
            {messages.map((msg, i) => {
              // Hide the invisible trigger message
              if (msg.text === "/feymantechnique") return null;
              
              return msg.role === "user" ? (
                <div className="msg-user" key={i}>
                  <div className="bubble">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className={`msg-ai ${chatMode === 'feynman' ? 'feynman-msg' : ''}`} key={i}>
                  <div className="bubble">
                    <div className="text-sm text-gray-800 leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full border border-gray-200 rounded-lg text-sm" {...props} />
                            </div>
                          ),
                          thead: ({node, ...props}) => (
                            <thead className="bg-gray-100 text-gray-700 font-semibold" {...props} />
                          ),
                          tbody: ({node, ...props}) => (
                            <tbody className="divide-y divide-gray-100" {...props} />
                          ),
                          tr: ({node, ...props}) => (
                            <tr className="hover:bg-gray-50 transition-colors" {...props} />
                          ),
                          th: ({node, ...props}) => (
                            <th className="px-4 py-2 text-left border-b border-gray-200" {...props} />
                          ),
                          td: ({node, ...props}) => (
                            <td className="px-4 py-2 text-gray-700" {...props} />
                          ),
                          h2: ({node, ...props}) => (
                            <h2 className="text-base font-bold text-gray-900 mt-5 mb-2 border-b border-gray-200 pb-1" {...props} />
                          ),
                          h3: ({node, ...props}) => (
                            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-1" {...props} />
                          ),
                          p: ({node, ...props}) => (
                            <p className="mb-3 text-gray-700 leading-relaxed" {...props} />
                          ),
                          ul: ({node, ...props}) => (
                            <ul className="list-disc list-inside space-y-1 mb-3 text-gray-700" {...props} />
                          ),
                          ol: ({node, ...props}) => (
                            <ol className="list-decimal list-inside space-y-1 mb-3 text-gray-700" {...props} />
                          ),
                          li: ({node, ...props}) => (
                            <li className="ml-2" {...props} />
                          ),
                          strong: ({node, ...props}) => (
                            <strong className="font-semibold text-gray-900" {...props} />
                          ),
                          code: ({node, ...props}) => (
                            <code className="bg-gray-100 text-indigo-600 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                          ),
                          pre: ({node, ...props}) => (
                            <pre className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto text-xs my-3 font-mono" {...props} />
                          ),
                          hr: ({node, ...props}) => (
                            <hr className="my-4 border-gray-200" {...props} />
                          ),
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="typing-indicator">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {error && <div className="error-bubble">{error}</div>}
            {uploadStatus && <div className="upload-status">{uploadStatus}</div>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

    {/* CHANGED: Feynman soft warning if no docs uploaded early on */}
    {chatMode === "feynman" && !hasUploadedDocs && messages.length > 0 && !loading && (
      <div className="feynman-no-docs-tip">
        Tip: Upload a document so I can validate your explanation against your study material.
      </div>
    )}

      <div className="main-bottom">
        {/* CHANGED: Feynman banner when listening */}
        {isFeynmanListening && (
          <div className="feynman-banner">
            🧠 Feynman Mode — Explain freely. We'll validate when you're done.
          </div>
        )}
        
        <div className={`searchbox ${isFeynmanListening ? 'feynman-active-box' : ''}`}>
          
          {/* CHANGED: Inline RAG Toggle inside the searchbox */}
          <div className="inline-rag-toggle-wrapper">
            <button
              className={`inline-rag-toggle ${chatMode === "feynman" ? "locked-on" : (ragMode ? "on" : "off")}`}
              onClick={handleToggleRag}
              disabled={chatMode === "feynman"}
              title={chatMode === "feynman" ? "RAG is required for Feynman validation" : "Query your uploaded documents"}
            >
              <FileText size={16} />
              <span className="rag-label">
                {ragMode || chatMode === "feynman" ? "RAG ✓" : "RAG"}
              </span>
            </button>
            {showTooltip && (
              <div className="rag-tooltip">
                Upload a PDF first to enable RAG mode
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              isFeynmanListening 
                ? "Explain the concept in your own words..." 
                : (ragMode || chatMode === "feynman" 
                    ? "Ask a question about your documents..." 
                    : "Enter your query (Shift+Enter for new line)")
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="search-icons">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              hidden
              onChange={handlePdfUpload}
            />
            <button
              className="icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload PDF for RAG"
            >
              <FileUp size={20} strokeWidth={1.5} />
            </button>
            <button
              className={`send-btn ${input.trim() ? "active" : ""}`}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              title="Send"
            >
              {isFeynmanListening ? (
                <span className="validate-btn-text">Validate →</span>
              ) : (
                <Send size={20} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Main;