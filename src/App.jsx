import React, { useState } from "react";
import { useAuth } from "@clerk/react";
import Sidebar from "./components/sidebar/Sidebar";
import Main from "./components/main/main";
import Login from "./components/login/Login";
import { useChatHistory } from "./hooks/useChatHistory";

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { chats, activeChatId, setActiveChatId, createNewChat, updateChatMessages, deleteChat } = useChatHistory();
  const { isSignedIn, isLoaded } = useAuth();

  const handleNewChat = () => {
    createNewChat();
    setSidebarOpen(false);
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat ? activeChat.messages : [];

  const handleMessagesChange = (newMessages) => {
    let currentId = activeChatId;
    if (!currentId) {
      currentId = createNewChat();
    }
    updateChatMessages(currentId, newMessages);
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <>
      {!isSignedIn ? (
        <div style={{ position: 'relative' }}>
          <Login />
        </div>
      ) : (
        <>
          <Sidebar
            extended={sidebarOpen}
            onToggle={() => setSidebarOpen(prev => !prev)}
            onClose={() => setSidebarOpen(false)}
            onNewChat={handleNewChat}
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={(id) => {
              setActiveChatId(id);
              setSidebarOpen(false);
            }}
            onDeleteChat={deleteChat}
          />
          <Main 
            key={activeChatId || 'empty'} 
            messages={messages}
            onMessagesChange={handleMessagesChange}
            onMenuClick={() => setSidebarOpen(prev => !prev)} 
            onNewChat={handleNewChat}
          />
        </>
      )}
    </>
  );
};

export default App;