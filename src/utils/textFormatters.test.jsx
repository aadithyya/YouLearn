import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { formatText, renderInline } from './textFormatters.jsx'

// ─── renderInline ───────────────────────────────────────────────

describe('renderInline', () => {
  it('returns plain text when no bold markers present', () => {
    const result = renderInline('Hello world')
    // Should be an array with a single plain string
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Hello world')
  })

  it('wraps text between ** markers in <strong> tags', () => {
    const { container } = render(<p>{renderInline('Hello **world**')}</p>)
    const strong = container.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong.textContent).toBe('world')
  })

  it('handles multiple bold segments', () => {
    const { container } = render(
      <p>{renderInline('**A** normal **B**')}</p>
    )
    const strongs = container.querySelectorAll('strong')
    expect(strongs).toHaveLength(2)
    expect(strongs[0].textContent).toBe('A')
    expect(strongs[1].textContent).toBe('B')
  })

  it('returns only plain text when given empty string', () => {
    const result = renderInline('')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('')
  })
})

// ─── formatText ─────────────────────────────────────────────────

describe('formatText', () => {
  it('returns a <br> for an empty string', () => {
    const { container } = render(<div>{formatText('')}</div>)
    expect(container.querySelectorAll('br')).toHaveLength(1)
  })

  it('wraps plain text in a <p> tag', () => {
    const { container } = render(<div>{formatText('Hello world')}</div>)
    const p = container.querySelector('p')
    expect(p).not.toBeNull()
    expect(p.textContent).toBe('Hello world')
  })

  it('renders ## headings as bold <p> elements', () => {
    const { container } = render(<div>{formatText('## My Heading')}</div>)
    const p = container.querySelector('p')
    expect(p).not.toBeNull()
    expect(p.style.fontWeight).toBe('600')
    expect(p.textContent).toBe('My Heading')
  })

  it('renders * bullet items as <ul>/<li>', () => {
    const text = '* Item A\n* Item B'
    const { container } = render(<div>{formatText(text)}</div>)
    const ul = container.querySelector('ul')
    expect(ul).not.toBeNull()
    const items = ul.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('Item A')
    expect(items[1].textContent).toBe('Item B')
  })

  it('renders - bullet items as <ul>/<li>', () => {
    const text = '- First\n- Second'
    const { container } = render(<div>{formatText(text)}</div>)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('First')
  })

  it('renders numbered lists as <li>', () => {
    const text = '1. Alpha\n2. Beta'
    const { container } = render(<div>{formatText(text)}</div>)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('Alpha')
    expect(items[1].textContent).toBe('Beta')
  })

  it('handles mixed content: paragraph then list then paragraph', () => {
    const text = 'Intro\n* Item\nConclusion'
    const { container } = render(<div>{formatText(text)}</div>)
    const ps = container.querySelectorAll('p')
    const lis = container.querySelectorAll('li')
    expect(ps).toHaveLength(2) // Intro + Conclusion
    expect(lis).toHaveLength(1)
  })

  it('renders bold text inside list items', () => {
    const text = '* **Bold** item'
    const { container } = render(<div>{formatText(text)}</div>)
    const strong = container.querySelector('li strong')
    expect(strong).not.toBeNull()
    expect(strong.textContent).toBe('Bold')
  })

  it('inserts <br> for blank lines', () => {
    const text = 'Line 1\n\nLine 2'
    const { container } = render(<div>{formatText(text)}</div>)
    expect(container.querySelectorAll('br')).toHaveLength(1)
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('flushes trailing list items at end of text', () => {
    const text = '* Trailing item'
    const { container } = render(<div>{formatText(text)}</div>)
    const ul = container.querySelector('ul')
    expect(ul).not.toBeNull()
    expect(ul.querySelectorAll('li')).toHaveLength(1)
  })
})
