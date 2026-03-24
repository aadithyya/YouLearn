import React, { useState, useRef, useEffect } from 'react'
import './Sidebar.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faPlus, faGear, faBrain } from '@fortawesome/free-solid-svg-icons'
import { faNoteSticky, faTrashCan, faPenToSquare, faCommentDots } from '@fortawesome/free-regular-svg-icons'

// CHANGED: Added onRenameChat prop for double-click manual rename
const Sidebar = ({ extended, onToggle, onClose, onNewChat, chats = [], activeChatId, onSelectChat, onRenameChat, onDeleteChat }) => {
  // CHANGED: State for inline editing of session titles
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef(null);
  const longPressTimer = useRef(null);
  
  // CHANGED: Dropdown state for New Chat / Feynman Technique
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // CHANGED: Truncate display title to max 22 characters
  const truncateTitle = (title) => {
    if (!title) return 'New Chat';
    return title.length > 22 ? title.substring(0, 22) + '…' : title;
  };

  // CHANGED: Enter rename mode on double-click or long-press
  const startEditing = (chat) => {
    setEditingId(chat.id);
    setEditValue(chat.title);
    // Focus the input after React renders it
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  // CHANGED: Commit the rename
  const commitRename = (chatId) => {
    const trimmed = editValue.trim();
    if (trimmed && onRenameChat) {
      onRenameChat(chatId, trimmed);
    }
    setEditingId(null);
    setEditValue('');
  };

  // CHANGED: Handle long-press for mobile touch rename
  const handleTouchStart = (chat) => {
    longPressTimer.current = setTimeout(() => startEditing(chat), 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <>
      {extended && <div className="sidebar-overlay" onClick={onClose} />}

      <div className={`sidebar ${extended ? 'extended' : 'collapsed'}`}>
        <div className="top">
          <div onClick={onToggle} className="menubar">
            <FontAwesomeIcon icon={faBars} />
          </div>

          {/* CHANGED: + button with Dropdown for Feynman / Standard */}
          <div className="newchat-container" ref={dropdownRef}>
            <div 
              className={`newchat-btn ${extended ? 'extended-btn' : ''}`}
              onClick={() => setDropdownOpen(prev => !prev)}
              title="Create new session"
            >
              <FontAwesomeIcon icon={faPlus} />
            </div>
            
            {dropdownOpen && (
              <div className="newchat-dropdown">
                <div 
                  className="dropdown-item"
                  onClick={() => {
                    onNewChat("standard");
                    setDropdownOpen(false);
                  }}
                >
                  <FontAwesomeIcon icon={faCommentDots} className="dropdown-icon" />
                  <div className="dropdown-text">
                    <span className="dropdown-label">Standard Chat</span>
                  </div>
                </div>
                <div 
                  className="dropdown-item feynman-option"
                  onClick={() => {
                    onNewChat("feynman");
                    setDropdownOpen(false);
                  }}
                >
                  <FontAwesomeIcon icon={faBrain} className="dropdown-icon feynman-icon" />
                  <div className="dropdown-text">
                    <span className="dropdown-label">Feynman Technique</span>
                    <span className="dropdown-sub">Explain a concept. We'll validate it.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {extended && (
            <div className="recent">
              <p className="recent-title">Recent</p>
              {chats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`recent-entry ${chat.id === activeChatId ? 'active' : ''}`}
                  onClick={() => onSelectChat(chat.id)}
                  // CHANGED: Double-click to rename on desktop
                  onDoubleClick={(e) => { e.stopPropagation(); startEditing(chat); }}
                  // CHANGED: Long-press to rename on mobile
                  onTouchStart={() => handleTouchStart(chat)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                >
                  <div className="recent-entry-left">
                    {/* CHANGED: Show 🧠 icon for Feynman sessions, normal icon otherwise */}
                    <FontAwesomeIcon icon={chat.mode === 'feynman' ? faBrain : faNoteSticky} style={{ color: chat.mode === 'feynman' ? '#8b5cf6' : '' }} />
                    {/* CHANGED: Inline editable title with truncation + fade animation */}
                    {editingId === chat.id ? (
                      <input
                        ref={editInputRef}
                        className="rename-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitRename(chat.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(chat.id);
                          if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="session-title">{truncateTitle(chat.title)}</p>
                    )}
                  </div>
                  <div className="recent-entry-actions">
                    {/* CHANGED: Edit button for explicit rename trigger */}
                    <div 
                      className="edit-chat-btn"
                      onClick={(e) => { e.stopPropagation(); startEditing(chat); }}
                      title="Rename Chat"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                    </div>
                    <div 
                      className="delete-chat-btn"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onDeleteChat) onDeleteChat(chat.id); 
                      }} 
                      title="Delete Chat"
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bottom">
          <div className="bottom-item">
            <FontAwesomeIcon icon={faGear} />
            {extended && <p>Settings</p>}
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar