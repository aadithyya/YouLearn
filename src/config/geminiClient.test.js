import { vi, describe, it, expect, beforeEach } from 'vitest'
import runChat from './geminiClient'

global.fetch = vi.fn()

describe('runChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('makes a successful API call with a prompt and returns data', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'AI response text' }),
    })

    const result = await runChat([{ role: 'user', text: 'Test prompt' }])
    expect(result).toBe('AI response text')
  })

  it('sends the correct request to /api/chat', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'ok' }),
    })

    await runChat([{ role: 'user', text: 'Hello' }]);

    expect(global.fetch).toHaveBeenCalledWith('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: 'Hello' }] }),
    })
  })

  it('throws an error if the fetch fails (non-200 OK)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    })

    await expect(runChat([{ role: 'user', text: 'Hello' }])).rejects.toThrow('Internal Server Error')
    expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
  })

  it('returns empty string if the API does not return a reply field', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ someOtherField: 'AI response text' }), 
    })

    const result = await runChat([{ role: 'user', text: 'Hello' }]);
    expect(result).toBe('')
  })

  it('throws an error if there is a network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'))

    await expect(runChat([{ role: 'user', text: 'Hello' }])).rejects.toThrow('Network Error')
    expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
  })

  it('throws an error if server returns 400 Bad Request', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request: No messages provided'
    })

    await expect(runChat([{ role: 'user', text: '' }])).rejects.toThrow('Bad Request: No messages provided')
    expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
  })
})
