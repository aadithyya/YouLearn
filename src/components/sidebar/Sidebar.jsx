import React from 'react'
import './Sidebar.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faPlus, faGear } from '@fortawesome/free-solid-svg-icons'
import { faNoteSticky, faTrashCan } from '@fortawesome/free-regular-svg-icons'

const Sidebar = ({ extended, onToggle, onClose, onNewChat, chats = [], activeChatId, onSelectChat, onDeleteChat }) => {
  return (
    <>
      {extended && <div className="sidebar-overlay" onClick={onClose} />}

      <div className={`sidebar ${extended ? 'extended' : 'collapsed'}`}>
        <div className="top">
          <div onClick={onToggle} className="menubar">
            <FontAwesomeIcon icon={faBars} />
          </div>

          <div className="newchat" onClick={onNewChat}>
            <FontAwesomeIcon icon={faPlus} />
            {extended && <p>New Chat</p>}
          </div>

          {extended && (
            <div className="recent">
              <p className="recent-title">Recent</p>
              {chats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`recent-entry ${chat.id === activeChatId ? 'active' : ''}`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <div className="recent-entry-left">
                    <FontAwesomeIcon icon={faNoteSticky} />
                    <p>{chat.title}</p>
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