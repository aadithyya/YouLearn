import { useState, useEffect } from 'react';

const STORAGE_KEY = 'youlearn-chats';

// CHANGED: Smart title extraction — strips question words, filler, and extracts 2-4 word topic
function extractTitle(message) {
  if (!message || !message.trim()) return '';

  let text = message.trim();

  // Only parse the first 12 words if message is very long
  const words = text.split(/\s+/);
  if (words.length > 12) {
    text = words.slice(0, 12).join(' ');
  }

  // Strip common question/filler prefixes (case-insensitive)
  const prefixes = [
    /^(what is|what are|what was|what were|what does|what do)/i,
    /^(how does|how do|how is|how are|how can|how to)/i,
    /^(why is|why are|why does|why do|why did)/i,
    /^(when is|when are|when does|when did|when was)/i,
    /^(where is|where are|where does|where did)/i,
    /^(who is|who are|who was|who were)/i,
    /^(can you|could you|would you|will you)/i,
    /^(tell me about|explain|describe|define|summarize|summarise)/i,
    /^(i want to know about|i need to understand|help me with)/i,
    /^(please|hey|hi|hello)/i,
  ];

  for (const regex of prefixes) {
    text = text.replace(regex, '').trim();
  }

  // Strip leading filler words
  const fillerWords = ['a', 'an', 'the', 'me', 'about', 'of', 'in', 'on', 'for', 'to', 'and', 'or'];
  let remaining = text.split(/\s+/);
  while (remaining.length > 0 && fillerWords.includes(remaining[0].toLowerCase())) {
    remaining.shift();
  }

  // Edge case: if nothing remains after stripping, use first 4 words of original message
  if (remaining.length === 0) {
    remaining = message.trim().split(/\s+/).slice(0, 4);
  }

  // Trim to max 4 words
  remaining = remaining.slice(0, 4);

  // Edge case: if the result is only numbers/gibberish (no letter), fallback
  const joined = remaining.join(' ');
  if (!/[a-zA-Z]/.test(joined)) {
    return 'Study Session';
  }

  // Title Case
  const titled = remaining
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return titled;
}

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

  // CHANGED: Accept optional mode ("standard" | "feynman")
  const createNewChat = (mode = "standard") => {
    const newChatId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
    const newChat = {
      id: newChatId,
      title: mode === "feynman" ? 'Feynman Session' : 'New Chat',
      mode: mode, // CHANGED: Track session mode
      messages: [],
      createdAt: new Date().toISOString(),
      hasBeenNamed: false
    };
    
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChatId);
    return newChatId;
  };

  const updateChatMessages = (id, newMessages) => {
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id !== id) return chat;
      
      const updatedChat = { ...chat, messages: newMessages };
      
      // CHANGED: Use smart extractTitle on first user message, only if not yet named
      if (!chat.hasBeenNamed && newMessages.length > 0) {
        const firstUserMsg = newMessages.find(m => m.role === 'user');
        if (firstUserMsg && firstUserMsg.text && firstUserMsg.text.trim()) {
          const smartTitle = extractTitle(firstUserMsg.text);
          if (smartTitle) {
            updatedChat.title = smartTitle;
            updatedChat.hasBeenNamed = true;
          }
        }
      }
      return updatedChat;
    }));
  };

  // CHANGED: Allow manual rename from sidebar double-click
  const renameChat = (id, newTitle) => {
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id !== id) return chat;
      return { ...chat, title: newTitle, hasBeenNamed: true };
    }));
  };

  const deleteChat = (id) => {
    const chatIndex = chats.findIndex(c => c.id === id);
    if (chatIndex === -1) return;

    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);

    if (activeChatId === id) {
      if (newChats.length > 0) {
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
    // CHANGED: Expose renameChat for sidebar double-click rename
    renameChat,
    deleteChat
  };
};
