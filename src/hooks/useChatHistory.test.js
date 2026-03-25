import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatHistory } from './useChatHistory';

describe('useChatHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  it('initializes with empty storage correctly', () => {
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.chats).toEqual([]);
    expect(result.current.activeChatId).toBeNull();
  });

  it('loads chats from localStorage on mount', () => {
    const fakeChats = [{ id: '123', title: 'Test Chat', messages: [] }];
    localStorage.setItem('youlearn-chats', JSON.stringify(fakeChats));

    const { result } = renderHook(() => useChatHistory());
    expect(result.current.chats).toEqual(fakeChats);
    expect(result.current.activeChatId).toBe('123');
  });

  it('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem('youlearn-chats', 'not-valid-json');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useChatHistory());
    expect(result.current.chats).toEqual([]);
    expect(result.current.activeChatId).toBeNull();

    consoleSpy.mockRestore();
  });

  it('sets activeChatId to first chat on load', () => {
    const fakeChats = [
      { id: 'first', title: 'First', messages: [] },
      { id: 'second', title: 'Second', messages: [] },
    ];
    localStorage.setItem('youlearn-chats', JSON.stringify(fakeChats));

    const { result } = renderHook(() => useChatHistory());
    expect(result.current.activeChatId).toBe('first');
  });

  // ── createNewChat ───────────────────────────────────────────────

  it('creates a new chat correctly', () => {
    const { result } = renderHook(() => useChatHistory());
    
    let newChatId;
    act(() => {
      newChatId = result.current.createNewChat();
    });

    expect(result.current.chats).toHaveLength(1);
    expect(result.current.chats[0].id).toBe(newChatId);
    expect(result.current.chats[0].title).toBe('New Chat');
    expect(result.current.activeChatId).toBe(newChatId);

    const saved = JSON.parse(localStorage.getItem('youlearn-chats'));
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(newChatId);
  });

  it('creates a feynman chat with correct title and mode', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => {
      chatId = result.current.createNewChat('feynman');
    });

    expect(result.current.chats[0].title).toBe('Feynman Session');
    expect(result.current.chats[0].mode).toBe('feynman');
  });

  it('creates standard chat by default', () => {
    const { result } = renderHook(() => useChatHistory());

    act(() => {
      result.current.createNewChat();
    });

    expect(result.current.chats[0].mode).toBe('standard');
  });

  it('prepends new chat to the list (newest first)', () => {
    const { result } = renderHook(() => useChatHistory());

    let id1, id2;
    act(() => { id1 = result.current.createNewChat(); });
    act(() => { id2 = result.current.createNewChat(); });

    expect(result.current.chats[0].id).toBe(id2);
    expect(result.current.chats[1].id).toBe(id1);
  });

  it('sets activeChatId to newly created chat', () => {
    const { result } = renderHook(() => useChatHistory());

    let id1, id2;
    act(() => { id1 = result.current.createNewChat(); });
    expect(result.current.activeChatId).toBe(id1);

    act(() => { id2 = result.current.createNewChat(); });
    expect(result.current.activeChatId).toBe(id2);
  });

  it('chat has hasBeenNamed set to false initially', () => {
    const { result } = renderHook(() => useChatHistory());

    act(() => { result.current.createNewChat(); });

    expect(result.current.chats[0].hasBeenNamed).toBe(false);
  });

  // ── updateChatMessages & extractTitle ───────────────────────────

  it('updates messages and generates title from first user message', () => {
    const { result } = renderHook(() => useChatHistory());
    
    let newChatId;
    act(() => {
      newChatId = result.current.createNewChat();
    });

    act(() => {
      result.current.updateChatMessages(newChatId, [
        { role: 'user', text: 'what is an operating system and how does it work' }
      ]);
    });

    const activeChat = result.current.chats[0];
    expect(activeChat.messages).toHaveLength(1);
    expect(activeChat.title).toBe('Operating System And How');
    expect(activeChat.hasBeenNamed).toBe(true);
  });

  it('does not rename chat after it has been named', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.updateChatMessages(chatId, [
        { role: 'user', text: 'first message about physics' }
      ]);
    });

    const firstTitle = result.current.chats[0].title;

    act(() => {
      result.current.updateChatMessages(chatId, [
        { role: 'user', text: 'first message about physics' },
        { role: 'ai', text: 'sure!' },
        { role: 'user', text: 'second message about chemistry' },
      ]);
    });

    expect(result.current.chats[0].title).toBe(firstTitle);
  });

  it('strips question prefixes from title', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.updateChatMessages(chatId, [
        { role: 'user', text: 'can you explain photosynthesis process' }
      ]);
    });

    expect(result.current.chats[0].title).toBe('Photosynthesis Process');
  });

  it('handles messages with only filler words gracefully', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.updateChatMessages(chatId, [
        { role: 'user', text: 'the a an' }
      ]);
    });

    // Should use first 4 words of original as fallback
    expect(result.current.chats[0].title).not.toBe('');
  });

  it('handles numeric-only message with "Study Session" fallback', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.updateChatMessages(chatId, [
        { role: 'user', text: '123 456' }
      ]);
    });

    expect(result.current.chats[0].title).toBe('Study Session');
  });

  it('ignores non-user messages for title generation', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.updateChatMessages(chatId, [
        { role: 'ai', text: 'Hello! I am the AI' }
      ]);
    });

    expect(result.current.chats[0].title).toBe('New Chat');
    expect(result.current.chats[0].hasBeenNamed).toBe(false);
  });

  // ── renameChat ──────────────────────────────────────────────────

  it('renames a chat correctly', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.renameChat(chatId, 'My Custom Title');
    });

    expect(result.current.chats[0].title).toBe('My Custom Title');
    expect(result.current.chats[0].hasBeenNamed).toBe(true);
  });

  it('rename persists through message updates', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.renameChat(chatId, 'Custom Name');
    });

    act(() => {
      result.current.updateChatMessages(chatId, [
        { role: 'user', text: 'new message about something' }
      ]);
    });

    expect(result.current.chats[0].title).toBe('Custom Name');
  });

  it('does not crash when renaming non-existent chat', () => {
    const { result } = renderHook(() => useChatHistory());

    expect(() => {
      act(() => {
        result.current.renameChat('nonexistent-id', 'Title');
      });
    }).not.toThrow();
  });

  // ── deleteChat ──────────────────────────────────────────────────

  it('deletes a chat from the list', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.deleteChat(chatId);
    });

    expect(result.current.chats).toHaveLength(0);
  });

  it('sets activeChatId to next chat when active chat is deleted', () => {
    const { result } = renderHook(() => useChatHistory());

    let id1, id2;
    act(() => { id1 = result.current.createNewChat(); });
    act(() => { id2 = result.current.createNewChat(); });

    // Active is id2 (newest)
    expect(result.current.activeChatId).toBe(id2);

    act(() => {
      result.current.deleteChat(id2);
    });

    expect(result.current.activeChatId).toBe(id1);
  });

  it('sets activeChatId to null when last chat is deleted', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.deleteChat(chatId);
    });

    expect(result.current.activeChatId).toBeNull();
  });

  it('does not crash when deleting non-existent chat', () => {
    const { result } = renderHook(() => useChatHistory());

    expect(() => {
      act(() => {
        result.current.deleteChat('nonexistent-id');
      });
    }).not.toThrow();
  });

  it('does not change activeChatId when deleting non-active chat', () => {
    const { result } = renderHook(() => useChatHistory());

    let id1, id2;
    act(() => { id1 = result.current.createNewChat(); });
    act(() => { id2 = result.current.createNewChat(); });

    act(() => {
      result.current.deleteChat(id1);
    });

    expect(result.current.activeChatId).toBe(id2);
    expect(result.current.chats).toHaveLength(1);
  });

  // ── localStorage persistence ────────────────────────────────────

  it('removes localStorage when all chats are deleted', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });
    expect(localStorage.getItem('youlearn-chats')).not.toBeNull();

    act(() => {
      result.current.deleteChat(chatId);
    });

    expect(localStorage.getItem('youlearn-chats')).toBeNull();
  });

  it('persists renamed chat to localStorage', () => {
    const { result } = renderHook(() => useChatHistory());

    let chatId;
    act(() => { chatId = result.current.createNewChat(); });

    act(() => {
      result.current.renameChat(chatId, 'Saved Title');
    });

    const saved = JSON.parse(localStorage.getItem('youlearn-chats'));
    expect(saved[0].title).toBe('Saved Title');
  });

  // ── setActiveChatId ─────────────────────────────────────────────

  it('allows switching active chat', () => {
    const { result } = renderHook(() => useChatHistory());

    let id1, id2;
    act(() => { id1 = result.current.createNewChat(); });
    act(() => { id2 = result.current.createNewChat(); });

    act(() => {
      result.current.setActiveChatId(id1);
    });

    expect(result.current.activeChatId).toBe(id1);
  });
});
