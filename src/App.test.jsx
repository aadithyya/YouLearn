import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, fireEvent, screen, act } from '@testing-library/react'

// ─── Mocks ──────────────────────────────────────────────────────

// Mock Clerk's useAuth and useUser
vi.mock('@clerk/react', () => ({
  useAuth: vi.fn(() => ({ isSignedIn: true, isLoaded: true })),
  useUser: vi.fn(() => ({ user: { firstName: 'Test' } })),
  UserButton: () => <div data-testid="user-button" />,
}))

// Track Main mount/unmount to verify remounting on new chat
let mainMountCount = 0

vi.mock('./components/main/main', () => ({
  default: (props) => {
    // Use a ref-like pattern via useEffect to count mounts
    const React = require('react')
    React.useEffect(() => {
      mainMountCount++
    }, [])
    return <div data-testid="main-component" />
  },
}))

vi.mock('./components/sidebar/Sidebar', () => ({
  default: ({ onNewChat, extended, onToggle, onClose }) => (
    <div data-testid="sidebar">
      <button data-testid="new-chat-btn" onClick={onNewChat}>
        New Chat
      </button>
      <button data-testid="toggle-btn" onClick={onToggle}>
        Toggle
      </button>
    </div>
  ),
}))

vi.mock('./components/login/Login', () => ({
  default: () => <div data-testid="login" />,
}))

import App from './App'
import { useAuth } from '@clerk/react'

// ─── Tests ──────────────────────────────────────────────────────

describe('App – New Chat functionality', () => {
  beforeEach(() => {
    mainMountCount = 0
    useAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
  })

  it('renders Sidebar and Main when signed in', () => {
    render(<App />)
    expect(screen.getByTestId('sidebar')).not.toBeNull()
    expect(screen.getByTestId('main-component')).not.toBeNull()
  })

  it('renders Login when not signed in', () => {
    useAuth.mockReturnValue({ isSignedIn: false, isLoaded: true })
    render(<App />)
    expect(screen.getByTestId('login')).not.toBeNull()
    expect(screen.queryByTestId('sidebar')).toBeNull()
  })

  it('renders nothing while auth is loading', () => {
    useAuth.mockReturnValue({ isSignedIn: false, isLoaded: false })
    const { container } = render(<App />)
    expect(container.innerHTML).toBe('')
  })

  it('remounts Main when New Chat button is clicked', () => {
    render(<App />)
    const initialCount = mainMountCount

    // Click "New Chat"
    fireEvent.click(screen.getByTestId('new-chat-btn'))

    // Main should have been remounted (count incremented)
    expect(mainMountCount).toBe(initialCount + 1)
  })

  it('remounts Main each time New Chat is clicked', () => {
    render(<App />)
    const initialCount = mainMountCount

    fireEvent.click(screen.getByTestId('new-chat-btn'))
    fireEvent.click(screen.getByTestId('new-chat-btn'))
    fireEvent.click(screen.getByTestId('new-chat-btn'))

    expect(mainMountCount).toBe(initialCount + 3)
  })

  it('Main component remains in DOM after New Chat click', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('new-chat-btn'))

    // Main should still be rendered (just a fresh instance)
    expect(screen.getByTestId('main-component')).not.toBeNull()
  })
})
