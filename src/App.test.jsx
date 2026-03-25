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
let lastMainProps = {}

vi.mock('./components/main/main', () => ({
  default: (props) => {
    const React = require('react')
    React.useEffect(() => {
      mainMountCount++
    }, [])
    lastMainProps = props
    return <div data-testid="main-component" />
  },
}))

let lastSidebarProps = {}

vi.mock('./components/sidebar/Sidebar', () => ({
  default: (props) => {
    lastSidebarProps = props
    return (
      <div data-testid="sidebar">
        <button data-testid="new-chat-btn" onClick={props.onNewChat}>
          New Chat
        </button>
        <button data-testid="new-chat-feynman" onClick={() => props.onNewChat("feynman")}>
          Feynman
        </button>
        <button data-testid="toggle-btn" onClick={props.onToggle}>
          Toggle
        </button>
        <button data-testid="close-btn" onClick={props.onClose}>
          Close
        </button>
        {props.chats && props.chats.map(c => (
          <button key={c.id} data-testid={`chat-${c.id}`} onClick={() => props.onSelectChat(c.id)}>
            {c.title}
          </button>
        ))}
      </div>
    )
  },
}))

vi.mock('./components/login/Login', () => ({
  default: () => <div data-testid="login" />,
}))

import App from './App'
import { useAuth } from '@clerk/react'

// ─── Tests ──────────────────────────────────────────────────────

describe('App – Authentication', () => {
  beforeEach(() => {
    mainMountCount = 0
    lastMainProps = {}
    lastSidebarProps = {}
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

  it('does not render Main when not signed in', () => {
    useAuth.mockReturnValue({ isSignedIn: false, isLoaded: true })
    render(<App />)
    expect(screen.queryByTestId('main-component')).toBeNull()
  })

  it('does not render Sidebar when not signed in', () => {
    useAuth.mockReturnValue({ isSignedIn: false, isLoaded: true })
    render(<App />)
    expect(screen.queryByTestId('sidebar')).toBeNull()
  })
})

describe('App – New Chat functionality', () => {
  beforeEach(() => {
    mainMountCount = 0
    lastMainProps = {}
    lastSidebarProps = {}
    useAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
  })

  it('remounts Main when New Chat button is clicked', () => {
    render(<App />)
    const initialCount = mainMountCount

    fireEvent.click(screen.getByTestId('new-chat-btn'))
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
    expect(screen.getByTestId('main-component')).not.toBeNull()
  })

  it('creates feynman chat when feynman button is clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('new-chat-feynman'))

    // The last sidebar props should now have chats with a feynman mode entry
    const feynmanChats = lastSidebarProps.chats.filter(c => c.mode === 'feynman')
    expect(feynmanChats.length).toBeGreaterThanOrEqual(1)
  })
})

describe('App – Sidebar Toggle', () => {
  beforeEach(() => {
    mainMountCount = 0
    lastMainProps = {}
    lastSidebarProps = {}
    useAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
  })

  it('passes extended=false to Sidebar initially', () => {
    render(<App />)
    expect(lastSidebarProps.extended).toBe(false)
  })

  it('toggles sidebar open when toggle is clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(lastSidebarProps.extended).toBe(true)
  })

  it('toggles sidebar closed when toggle is clicked again', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(lastSidebarProps.extended).toBe(true)

    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(lastSidebarProps.extended).toBe(false)
  })

  it('closes sidebar when close button is clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(lastSidebarProps.extended).toBe(true)

    fireEvent.click(screen.getByTestId('close-btn'))
    expect(lastSidebarProps.extended).toBe(false)
  })

  it('closes sidebar when new chat is created', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(lastSidebarProps.extended).toBe(true)

    fireEvent.click(screen.getByTestId('new-chat-btn'))
    expect(lastSidebarProps.extended).toBe(false)
  })
})

describe('App – Chat Selection', () => {
  beforeEach(() => {
    mainMountCount = 0
    lastMainProps = {}
    lastSidebarProps = {}
    useAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
  })

  it('passes empty messages to Main initially with no chats', () => {
    render(<App />)
    expect(lastMainProps.messages).toEqual([])
  })

  it('creates a new chat and passes it to sidebar', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('new-chat-btn'))

    expect(lastSidebarProps.chats.length).toBeGreaterThanOrEqual(1)
  })

  it('passes standard chatMode by default', () => {
    render(<App />)
    expect(lastMainProps.chatMode).toBe('standard')
  })
})
