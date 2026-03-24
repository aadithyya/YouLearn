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

  it('calls onNewChat when the Standard Chat dropdown item is clicked', () => {
    const onNewChat = vi.fn()
    const { container } = render(
      <Sidebar {...defaultProps} onNewChat={onNewChat} />
    )

    const newChatBtn = container.querySelector('.newchat-btn')
    expect(newChatBtn).not.toBeNull()
    fireEvent.click(newChatBtn)
    
    // Dropdown opens
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
    
    // Dropdown opens
    const feynmanOption = container.querySelectorAll('.dropdown-item')[1]
    fireEvent.click(feynmanOption)
    expect(onNewChat).toHaveBeenCalledWith("feynman")
  })

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
    // Defensive: component should not break if prop is missing
    expect(() => {
      const { container } = render(
        <Sidebar extended={false} onToggle={vi.fn()} onClose={vi.fn()} />
      )
      const newChatBtn = container.querySelector('.newchat-btn')
      fireEvent.click(newChatBtn)
    }).not.toThrow()
  })
})
