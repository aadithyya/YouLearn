import React from 'react'
import './Sidebar.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faPlus, faClockRotateLeft, faGear } from '@fortawesome/free-solid-svg-icons'
import { faNoteSticky, faCircleQuestion } from '@fortawesome/free-regular-svg-icons'

const Sidebar = ({ extended, onToggle, onClose }) => {
  return (
    <>
      {extended && <div className="sidebar-overlay" onClick={onClose} />}

      <div className={`sidebar ${extended ? 'extended' : 'collapsed'}`}>
        <div className="top">
          <div onClick={onToggle} className="menubar">
            <FontAwesomeIcon icon={faBars} />
          </div>

          <div className="newchat">
            <FontAwesomeIcon icon={faPlus} />
            {extended && <p>New Chat</p>}
          </div>

          {extended && (
            <div className="recent">
              <p className="recent-title">Recent</p>
              <div className="recent-entry">
                <FontAwesomeIcon icon={faNoteSticky} />
                <p></p>
              </div>
            </div>
          )}
        </div>

        <div className="bottom">
          <div className="bottom-item">
            <FontAwesomeIcon icon={faCircleQuestion} />
            {extended && <p>Help</p>}
          </div>
          <div className="bottom-item">
            <FontAwesomeIcon icon={faClockRotateLeft} />
            {extended && <p>History</p>}
          </div>
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