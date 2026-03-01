import React, { useState, useRef, useEffect } from "react";
import "./Main.css";
import runChat from "../../config/geminiClient";
import {
  User, Lightbulb, MessageSquare, FileCode,
  Navigation, Mic, Send, Image, Menu
} from "lucide-react";

const formatText = (text) => {
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${key}`}>{listItems}</ul>);
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      listItems.push(<li key={i}>{renderInline(trimmed.slice(2))}</li>);
      return;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      listItems.push(<li key={i}>{renderInline(numMatch[2])}</li>);
      return;
    }

    flushList(i);

    if (trimmed === "") {
      elements.push(<br key={i} />);
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={i} style={{ fontWeight: 600, marginBottom: "4px" }}>
          {renderInline(trimmed.slice(3))}
        </p>
      );
      return;
    }

    elements.push(<p key={i}>{renderInline(trimmed)}</p>);
  });

  flushList("end");
  return elements;
};

const renderInline = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
};

const SUGGESTIONS = [
  { text: "Suggest the best route for a road trip", icon: <Navigation size={18} strokeWidth={1.5} /> },
  { text: "Give me a fun fact I probably don't know", icon: <Lightbulb size={18} strokeWidth={1.5} /> },
  { text: "Help me write a message to my friend", icon: <MessageSquare size={18} strokeWidth={1.5} /> },
  { text: "Explain how React hooks work", icon: <FileCode size={18} strokeWidth={1.5} /> },
];

const Main = ({ onMenuClick }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "24px";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const aiResponse = await runChat(text);
      setMessages(prev => [...prev, { role: "ai", text: aiResponse }]);
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

  const showWelcome = messages.length === 0 && !loading;

  return (
    <div className="main">
      {/* Nav */}
      <div className="nav">
        <div className="nav-left">
          <button className="nav-menu-btn" onClick={onMenuClick}>
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <p>YouLearn</p>
        </div>
        <div className="user-icon">
          <User size={24} strokeWidth={1.5} />
        </div>
      </div>

      {/* Chat / Welcome area */}
      <div className="main-container">
        {showWelcome ? (
          <div className="welcome">
            <div className="greet">
              <p><span>Hello, User</span></p>
              <p>How can I help you today?</p>
            </div>
            <div className="cards">
              {SUGGESTIONS.map((s, i) => (
                <div className="card" key={i} onClick={() => setInput(s.text)}>
                  <p>{s.text}</p>
                  <div className="card-icon">{s.icon}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-history">
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div className="msg-user" key={i}>
                  <div className="bubble">{msg.text}</div>
                </div>
              ) : (
                <div className="msg-ai" key={i}>
                  <div className="ai-avatar">Y</div>
                  <div className="bubble">{formatText(msg.text)}</div>
                </div>
              )
            )}

            {loading && (
              <div className="typing-indicator">
                <div className="ai-avatar">Y</div>
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

      {/* Input */}
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
          <div className="search-icons">
            <button className="icon-btn" title="Attach">
              <Image size={20} strokeWidth={1.5} />
            </button>
            <button className="icon-btn" title="Voice">
              <Mic size={20} strokeWidth={1.5} />
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
        <p className="bottom-info">AI can make mistakes. Verify important information.</p>
      </div>
    </div>
  );
};

export default Main;