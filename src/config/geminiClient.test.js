import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch before importing the module
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Dynamic import so the stub is in place
const { default: runChat } = await import('./geminiClient.js')

describe('runChat', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns the reply text on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'AI response text' }),
    })

    const result = await runChat('Hello')
    expect(result).toBe('AI response text')
  })

  it('sends the correct request to /api/gemini', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'ok' }),
    })

    await runChat('Test prompt')

    expect(mockFetch).toHaveBeenCalledWith('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Test prompt' }),
    })
  })

  it('throws an error when the response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Internal Server Error',
    })

    await expect(runChat('bad prompt')).rejects.toThrow('Internal Server Error')
  })

  it('returns empty string when reply field is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await runChat('test')
    expect(result).toBe('')
  })

  it('prefers reply over text field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'from reply', text: 'from text' }),
    })

    const result = await runChat('test')
    expect(result).toBe('from reply')
  })

  it('falls back to text field when reply is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'fallback text' }),
    })

    const result = await runChat('test')
    expect(result).toBe('fallback text')
  })
})
