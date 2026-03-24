import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatHistory } from './useChatHistory';

describe('useChatHistory', () => {
  beforeEach(() => {
    localStorage.clear();

    vi.clearAllMocks();
  });

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
    // extractTitle strips "what is an" → "Operating System And How"
    expect(activeChat.title).toBe('Operating System And How');
    expect(activeChat.hasBeenNamed).toBe(true);
  });
});
