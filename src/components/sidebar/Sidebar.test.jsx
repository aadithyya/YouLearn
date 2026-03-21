import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import Sidebar from './Sidebar'

// ─── Sidebar: New Chat button ───────────────────────────────────

describe('Sidebar', () => {
  const defaultProps = {
    extended: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    onNewChat: vi.fn(),
  }

  it('calls onNewChat when the new-chat button is clicked (collapsed)', () => {
    const onNewChat = vi.fn()
    const { container } = render(
      <Sidebar {...defaultProps} onNewChat={onNewChat} />
    )

    const newChatBtn = container.querySelector('.newchat')
    expect(newChatBtn).not.toBeNull()
    fireEvent.click(newChatBtn)
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('calls onNewChat when the new-chat button is clicked (extended)', () => {
    const onNewChat = vi.fn()
    const { container } = render(
      <Sidebar {...defaultProps} extended={true} onNewChat={onNewChat} />
    )

    const newChatBtn = container.querySelector('.newchat')
    fireEvent.click(newChatBtn)
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('shows "New Chat" label text only when extended', () => {
    const { container, rerender } = render(
      <Sidebar {...defaultProps} extended={false} />
    )

    // Collapsed: no <p> inside .newchat
    const collapsedP = container.querySelector('.newchat p')
    expect(collapsedP).toBeNull()

    // Extended: shows <p>New Chat</p>
    rerender(<Sidebar {...defaultProps} extended={true} />)
    const extendedP = container.querySelector('.newchat p')
    expect(extendedP).not.toBeNull()
    expect(extendedP.textContent).toBe('New Chat')
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
    // Defensive: component should not break if prop is missing
    expect(() => {
      const { container } = render(
        <Sidebar extended={false} onToggle={vi.fn()} onClose={vi.fn()} />
      )
      const newChatBtn = container.querySelector('.newchat')
      fireEvent.click(newChatBtn)
    }).not.toThrow()
  })
})
