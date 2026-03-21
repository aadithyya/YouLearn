import { useState, useEffect } from 'react';

const STORAGE_KEY = 'youlearn-chats';

export const useChatHistory = () => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setChats(parsed);
        if (parsed.length > 0) {
          setActiveChatId(parsed[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to parse chat history', e);
    }
  }, []);

  // Save to localStorage whenever chats change
  useEffect(() => {
    try {
      if (chats.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save chat history', e);
    }
  }, [chats]);

  const generateTitle = (text) => {
    if (!text) return 'New Chat';
    return text.length > 30 ? text.substring(0, 30) + '...' : text;
  };

  const createNewChat = () => {
    const newChatId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString()
    };
    
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChatId);
    return newChatId;
  };

  const updateChatMessages = (id, newMessages) => {
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id !== id) return chat;
      
      const updatedChat = { ...chat, messages: newMessages };
      
      // Auto-generate title from first user message if it's currently "New Chat"
      if (chat.title === 'New Chat' && newMessages.length > 0) {
        const firstUserMsg = newMessages.find(m => m.role === 'user');
        if (firstUserMsg && !firstUserMsg.isPdf) {
           updatedChat.title = generateTitle(firstUserMsg.text);
        } else if (firstUserMsg && firstUserMsg.isPdf) {
           // If first is PDF, it starts with 📄
           updatedChat.title = generateTitle(firstUserMsg.text);
        }
      }
      return updatedChat;
    }));
  };

  const deleteChat = (id) => {
    const chatIndex = chats.findIndex(c => c.id === id);
    if (chatIndex === -1) return;

    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);

    if (activeChatId === id) {
      if (newChats.length > 0) {
        // select the chat at the same index, or the last one if we deleted the last item
        setActiveChatId(newChats[Math.min(chatIndex, newChats.length - 1)].id);
      } else {
        setActiveChatId(null);
      }
    }
  };

  return {
    chats,
    activeChatId,
    setActiveChatId,
    createNewChat,
    updateChatMessages,
    deleteChat
  };
};
