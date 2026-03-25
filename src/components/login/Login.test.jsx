import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'

// Mock Clerk components
vi.mock('@clerk/react', () => ({
  SignIn: () => <div data-testid="clerk-sign-in">SignIn Form</div>,
  SignUp: () => <div data-testid="clerk-sign-up">SignUp Form</div>,
}))

import Login from './Login'

describe('Login Component', () => {
  it('renders the brand name', () => {
    const { container } = render(<Login />)
    expect(container.querySelector('.login-brand').textContent).toContain('YouLearn')
  })

  it('renders the heading text', () => {
    const { container } = render(<Login />)
    const heading = container.querySelector('.login-heading')
    expect(heading).not.toBeNull()
    expect(heading.textContent).toContain('Start Your Study')
    expect(heading.textContent).toContain('with YouLearn.')
  })

  it('renders the subtitle text', () => {
    const { container } = render(<Login />)
    const sub = container.querySelector('.login-sub')
    expect(sub).not.toBeNull()
    expect(sub.textContent).toContain('Quick login')
  })

  it('renders Log In and Sign Up buttons initially', () => {
    const { container } = render(<Login />)
    const buttons = container.querySelectorAll('.login-btns button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].textContent).toBe('Log In')
    expect(buttons[1].textContent).toBe('Sign Up')
  })

  it('shows Clerk SignIn component when Log In is clicked', () => {
    render(<Login />)
    
    const loginBtn = screen.getByText('Log In')
    fireEvent.click(loginBtn)

    expect(screen.getByTestId('clerk-sign-in')).not.toBeNull()
    expect(screen.queryByText('Log In')).toBeNull()
  })

  it('shows Clerk SignUp component when Sign Up is clicked', () => {
    render(<Login />)
    
    const signupBtn = screen.getByText('Sign Up')
    fireEvent.click(signupBtn)

    expect(screen.getByTestId('clerk-sign-up')).not.toBeNull()
    expect(screen.queryByText('Sign Up')).toBeNull()
  })

  it('shows Back button in login mode and returns to initial state', () => {
    render(<Login />)
    
    fireEvent.click(screen.getByText('Log In'))
    expect(screen.getByTestId('clerk-sign-in')).not.toBeNull()

    fireEvent.click(screen.getByText('← Back'))
    expect(screen.getByText('Log In')).not.toBeNull()
    expect(screen.getByText('Sign Up')).not.toBeNull()
  })

  it('shows Back button in signup mode and returns to initial state', () => {
    render(<Login />)
    
    fireEvent.click(screen.getByText('Sign Up'))
    expect(screen.getByTestId('clerk-sign-up')).not.toBeNull()

    fireEvent.click(screen.getByText('← Back'))
    expect(screen.getByText('Log In')).not.toBeNull()
    expect(screen.getByText('Sign Up')).not.toBeNull()
  })

  it('only shows one Clerk form at a time', () => {
    render(<Login />)
    
    fireEvent.click(screen.getByText('Log In'))
    expect(screen.getByTestId('clerk-sign-in')).not.toBeNull()
    expect(screen.queryByTestId('clerk-sign-up')).toBeNull()
  })

  it('renders the illustration image on the right', () => {
    const { container } = render(<Login />)
    const img = container.querySelector('.login-illustration')
    expect(img).not.toBeNull()
    expect(img.alt).toBe('Grow illustration')
  })

  it('renders the login page layout with left and right sections', () => {
    const { container } = render(<Login />)
    expect(container.querySelector('.login-left')).not.toBeNull()
    expect(container.querySelector('.login-right')).not.toBeNull()
  })
})
