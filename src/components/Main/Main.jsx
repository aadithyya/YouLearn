import React, { useState, useRef, useEffect } from "react";
import "./Main.css";
import runChat from "../../config/geminiClient";
import { formatText } from "../../utils/textFormatters.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGraduationCap, faBrain, faCubes, faNewspaper, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { User, Send, Menu, FileText } from "lucide-react";
import { UserButton, useUser } from "@clerk/react";




const Main = ({ messages = [], onMessagesChange, onMenuClick, onNewChat }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "24px";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", text }];
    onMessagesChange(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const aiResponse = await runChat(text);
      onMessagesChange([...newMessages, { role: "ai", text: aiResponse }]);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const newMessages = [...messages, { role: "user", text: `📄 ${file.name}`, isPdf: true }];
    onMessagesChange(newMessages);
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/rag/process-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.detail || data.error || 'Failed to process PDF');
      } else {
        onMessagesChange([...newMessages, { role: "ai", text: "PDF uploaded and processed! You can now ask questions about it." }]);
      }
    } catch (err) {
      setError("Failed to upload PDF. Please try again.");
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
        <div className="user-icon">
          <UserButton />
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
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div className="msg-user" key={i}>
                  <div className={`bubble ${msg.isPdf ? 'pdf-bubble' : ''}`}>
                    {msg.isPdf && <FileText size={16} strokeWidth={1.5} style={{ marginRight: 6, verticalAlign: 'middle' }} />}
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className="msg-ai" key={i}>
                  <div className="bubble">{formatText(msg.text)}</div>
                </div>
              )
            )}

            {loading && (
              <div className="typing-indicator">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {error && <div className="error-bubble">{error}</div>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="main-bottom">
        <div className="searchbox">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Enter your query (Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handlePdfUpload}
            />
          <div className="search-icons">
            <button
              className="icon-btn"
              title="Upload PDF"
              onClick={() => fileInputRef.current?.click()}
            >
              <FontAwesomeIcon icon={faFilePdf} style={{ fontSize: 18 }} />
            </button>
            <button
              className={`send-btn ${input.trim() ? "active" : ""}`}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              title="Send"
            >
              <Send size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Main;