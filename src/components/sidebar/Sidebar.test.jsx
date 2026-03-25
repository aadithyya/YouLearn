import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import Sidebar from './Sidebar'

// ─── Sidebar Tests ──────────────────────────────────────────────

describe('Sidebar', () => {
  const defaultProps = {
    extended: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    onNewChat: vi.fn(),
  }

  // ── New Chat Dropdown ───────────────────────────────────────────

  it('calls onNewChat when the Standard Chat dropdown item is clicked', () => {
    const onNewChat = vi.fn()
    const { container } = render(
      <Sidebar {...defaultProps} onNewChat={onNewChat} />
    )

    const newChatBtn = container.querySelector('.newchat-btn')
    expect(newChatBtn).not.toBeNull()
    fireEvent.click(newChatBtn)
    
    const standardOption = container.querySelectorAll('.dropdown-item')[0]
    fireEvent.click(standardOption)
    expect(onNewChat).toHaveBeenCalledWith("standard")
  })

  it('calls onNewChat when the Feynman Technique dropdown item is clicked', () => {
    const onNewChat = vi.fn()
    const { container } = render(
      <Sidebar {...defaultProps} onNewChat={onNewChat} />
    )

    const newChatBtn = container.querySelector('.newchat-btn')
    fireEvent.click(newChatBtn)
    
    const feynmanOption = container.querySelectorAll('.dropdown-item')[1]
    fireEvent.click(feynmanOption)
    expect(onNewChat).toHaveBeenCalledWith("feynman")
  })

  it('toggles dropdown open and close', () => {
    const { container } = render(<Sidebar {...defaultProps} />)
    const newChatBtn = container.querySelector('.newchat-btn')

    // Initially no dropdown
    expect(container.querySelector('.newchat-dropdown')).toBeNull()

    // Click to open
    fireEvent.click(newChatBtn)
    expect(container.querySelector('.newchat-dropdown')).not.toBeNull()

    // Click again to close
    fireEvent.click(newChatBtn)
    expect(container.querySelector('.newchat-dropdown')).toBeNull()
  })

  it('closes dropdown after selecting an option', () => {
    const { container } = render(<Sidebar {...defaultProps} onNewChat={vi.fn()} />)
    const newChatBtn = container.querySelector('.newchat-btn')

    fireEvent.click(newChatBtn)
    expect(container.querySelector('.newchat-dropdown')).not.toBeNull()

    const standardOption = container.querySelectorAll('.dropdown-item')[0]
    fireEvent.click(standardOption)
    expect(container.querySelector('.newchat-dropdown')).toBeNull()
  })

  // ── Extended state ──────────────────────────────────────────────

  it('adds extended-btn class when extended', () => {
    const { container, rerender } = render(
      <Sidebar {...defaultProps} extended={false} />
    )

    const btn = container.querySelector('.newchat-btn')
    expect(btn.classList.contains('extended-btn')).toBe(false)

    rerender(<Sidebar {...defaultProps} extended={true} />)
    expect(btn.classList.contains('extended-btn')).toBe(true)
  })

  it('calls onToggle when the menu bar is clicked', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <Sidebar {...defaultProps} onToggle={onToggle} />
    )

    const menubar = container.querySelector('.menubar')
    fireEvent.click(menubar)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders the overlay only when extended', () => {
    const { container, rerender } = render(
      <Sidebar {...defaultProps} extended={false} />
    )

    expect(container.querySelector('.sidebar-overlay')).toBeNull()

    rerender(<Sidebar {...defaultProps} extended={true} />)
    expect(container.querySelector('.sidebar-overlay')).not.toBeNull()
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} onClose={onClose} />
    )

    fireEvent.click(container.querySelector('.sidebar-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows recent section only when extended', () => {
    const { container, rerender } = render(
      <Sidebar {...defaultProps} extended={false} />
    )

    expect(container.querySelector('.recent')).toBeNull()

    rerender(<Sidebar {...defaultProps} extended={true} />)
    expect(container.querySelector('.recent')).not.toBeNull()
  })

  it('does not crash when onNewChat is undefined', () => {
    expect(() => {
      const { container } = render(
        <Sidebar extended={false} onToggle={vi.fn()} onClose={vi.fn()} />
      )
      const newChatBtn = container.querySelector('.newchat-btn')
      fireEvent.click(newChatBtn)
    }).not.toThrow()
  })

  // ── Chat list rendering ─────────────────────────────────────────

  it('renders chat items when extended with chats', () => {
    const chats = [
      { id: '1', title: 'Chat One', mode: 'standard', messages: [] },
      { id: '2', title: 'Chat Two', mode: 'feynman', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} />
    )

    const entries = container.querySelectorAll('.recent-entry')
    expect(entries).toHaveLength(2)
  })

  it('highlights the active chat', () => {
    const chats = [
      { id: '1', title: 'Chat One', mode: 'standard', messages: [] },
      { id: '2', title: 'Chat Two', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} activeChatId="2" />
    )

    const entries = container.querySelectorAll('.recent-entry')
    expect(entries[0].classList.contains('active')).toBe(false)
    expect(entries[1].classList.contains('active')).toBe(true)
  })

  it('calls onSelectChat when a chat entry is clicked', () => {
    const onSelectChat = vi.fn()
    const chats = [
      { id: 'abc', title: 'Test Chat', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} onSelectChat={onSelectChat} />
    )

    const entry = container.querySelector('.recent-entry')
    fireEvent.click(entry)
    expect(onSelectChat).toHaveBeenCalledWith('abc')
  })

  // ── Title truncation ────────────────────────────────────────────

  it('truncates long chat titles', () => {
    const chats = [
      { id: '1', title: 'This Is A Very Long Chat Title That Exceeds Maximum', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} />
    )

    const title = container.querySelector('.session-title')
    expect(title.textContent.length).toBeLessThanOrEqual(23) // 22 chars + ellipsis
    expect(title.textContent).toContain('…')
  })

  it('does not truncate short titles', () => {
    const chats = [
      { id: '1', title: 'Short Title', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} />
    )

    const title = container.querySelector('.session-title')
    expect(title.textContent).toBe('Short Title')
  })

  it('shows "New Chat" for empty title', () => {
    const chats = [
      { id: '1', title: '', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} />
    )

    const title = container.querySelector('.session-title')
    expect(title.textContent).toBe('New Chat')
  })

  // ── Delete button ───────────────────────────────────────────────

  it('calls onDeleteChat when delete button is clicked', () => {
    const onDeleteChat = vi.fn()
    const chats = [
      { id: 'del-1', title: 'To Delete', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} onDeleteChat={onDeleteChat} />
    )

    const deleteBtn = container.querySelector('.delete-chat-btn')
    fireEvent.click(deleteBtn)
    expect(onDeleteChat).toHaveBeenCalledWith('del-1')
  })

  it('delete button click does not trigger chat selection', () => {
    const onSelectChat = vi.fn()
    const onDeleteChat = vi.fn()
    const chats = [
      { id: '1', title: 'Chat', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} onSelectChat={onSelectChat} onDeleteChat={onDeleteChat} />
    )

    const deleteBtn = container.querySelector('.delete-chat-btn')
    fireEvent.click(deleteBtn)
    expect(onDeleteChat).toHaveBeenCalled()
    expect(onSelectChat).not.toHaveBeenCalled()
  })

  // ── Edit/Rename button ──────────────────────────────────────────

  it('enters rename mode when edit button is clicked', () => {
    const chats = [
      { id: '1', title: 'Old Title', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} />
    )

    const editBtn = container.querySelector('.edit-chat-btn')
    fireEvent.click(editBtn)

    const renameInput = container.querySelector('.rename-input')
    expect(renameInput).not.toBeNull()
    expect(renameInput.value).toBe('Old Title')
  })

  it('commits rename on blur', () => {
    const onRenameChat = vi.fn()
    const chats = [
      { id: '1', title: 'Old Title', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} onRenameChat={onRenameChat} />
    )

    const editBtn = container.querySelector('.edit-chat-btn')
    fireEvent.click(editBtn)

    const renameInput = container.querySelector('.rename-input')
    fireEvent.change(renameInput, { target: { value: 'New Title' } })
    fireEvent.blur(renameInput)

    expect(onRenameChat).toHaveBeenCalledWith('1', 'New Title')
  })

  it('commits rename on Enter key', () => {
    const onRenameChat = vi.fn()
    const chats = [
      { id: '1', title: 'Old Title', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} onRenameChat={onRenameChat} />
    )

    const editBtn = container.querySelector('.edit-chat-btn')
    fireEvent.click(editBtn)

    const renameInput = container.querySelector('.rename-input')
    fireEvent.change(renameInput, { target: { value: 'Enter Title' } })
    fireEvent.keyDown(renameInput, { key: 'Enter' })

    expect(onRenameChat).toHaveBeenCalledWith('1', 'Enter Title')
  })

  it('cancels rename on Escape key', () => {
    const onRenameChat = vi.fn()
    const chats = [
      { id: '1', title: 'Old Title', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} onRenameChat={onRenameChat} />
    )

    const editBtn = container.querySelector('.edit-chat-btn')
    fireEvent.click(editBtn)

    const renameInput = container.querySelector('.rename-input')
    fireEvent.change(renameInput, { target: { value: 'Changed' } })
    fireEvent.keyDown(renameInput, { key: 'Escape' })

    expect(onRenameChat).not.toHaveBeenCalled()
    // Should exit edit mode
    expect(container.querySelector('.rename-input')).toBeNull()
  })

  it('edit button click does not trigger chat selection', () => {
    const onSelectChat = vi.fn()
    const chats = [
      { id: '1', title: 'Chat', mode: 'standard', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} onSelectChat={onSelectChat} />
    )

    const editBtn = container.querySelector('.edit-chat-btn')
    fireEvent.click(editBtn)
    expect(onSelectChat).not.toHaveBeenCalled()
  })

  // ── Feynman mode icon ───────────────────────────────────────────

  it('shows feynman icon style for feynman chats', () => {
    const chats = [
      { id: '1', title: 'Feynman Chat', mode: 'feynman', messages: [] },
    ]
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} chats={chats} />
    )

    const entryLeft = container.querySelector('.recent-entry-left')
    const icon = entryLeft.querySelector('svg')
    expect(icon).not.toBeNull()
  })

  // ── Settings ────────────────────────────────────────────────────

  it('renders the Settings item in the bottom section', () => {
    const { container } = render(<Sidebar {...defaultProps} extended={true} />)
    const bottomItem = container.querySelector('.bottom-item')
    expect(bottomItem).not.toBeNull()
    expect(bottomItem.textContent).toContain('Settings')
  })

  it('hides Settings label when collapsed', () => {
    const { container } = render(<Sidebar {...defaultProps} extended={false} />)
    const bottomItem = container.querySelector('.bottom-item')
    // Should only have the icon, not the text
    expect(bottomItem.querySelector('p')).toBeNull()
  })
})
