import { vi, describe, it, expect, beforeEach } from 'vitest'
import runChat, { uploadPdfs, ragChat } from './geminiClient'

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

  it('falls back to data.text when reply is missing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'fallback text' }),
    })

    const result = await runChat([{ role: 'user', text: 'Hi' }])
    expect(result).toBe('fallback text')
  })

  it('sends multiple messages correctly', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'response' }),
    })

    const messages = [
      { role: 'user', text: 'Hello' },
      { role: 'ai', text: 'Hi there' },
      { role: 'user', text: 'How are you?' },
    ]
    await runChat(messages)

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.messages).toHaveLength(3)
    expect(callBody.messages[2].text).toBe('How are you?')
  })

  it('throws with fallback message when error text is empty', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => ''
    })

    await expect(runChat([{ role: 'user', text: 'Hello' }])).rejects.toThrow('Server error')
  })
})

// ─── uploadPdfs ─────────────────────────────────────────────────

describe('uploadPdfs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads files with FormData and returns response JSON', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', chunks_added: 5 }),
    })

    const mockFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' })
    const result = await uploadPdfs([mockFile])

    expect(result).toEqual({ status: 'ok', chunks_added: 5 })
    expect(global.fetch).toHaveBeenCalledWith('/api/upload', {
      method: 'POST',
      body: expect.any(FormData),
    })
  })

  it('throws on non-OK response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Upload failed: too large',
    })

    const mockFile = new File(['data'], 'big.pdf', { type: 'application/pdf' })
    await expect(uploadPdfs([mockFile])).rejects.toThrow('Upload failed: too large')
  })

  it('throws with fallback message on empty error text', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: async () => '',
    })

    const mockFile = new File(['data'], 'test.pdf', { type: 'application/pdf' })
    await expect(uploadPdfs([mockFile])).rejects.toThrow('Upload failed')
  })

  it('handles multiple files', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ chunks_added: 10 }),
    })

    const file1 = new File(['a'], 'a.pdf', { type: 'application/pdf' })
    const file2 = new File(['b'], 'b.pdf', { type: 'application/pdf' })
    await uploadPdfs([file1, file2])

    const formData = global.fetch.mock.calls[0][1].body
    expect(formData).toBeInstanceOf(FormData)
  })

  it('throws on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'))

    const mockFile = new File(['data'], 'test.pdf', { type: 'application/pdf' })
    await expect(uploadPdfs([mockFile])).rejects.toThrow('Network failure')
  })
})

// ─── ragChat ────────────────────────────────────────────────────

describe('ragChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends question to /api/rag/chat and returns answer', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'RAG answer' }),
    })

    const result = await ragChat('What is Python?')
    expect(result).toBe('RAG answer')
    expect(global.fetch).toHaveBeenCalledWith('/api/rag/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is Python?', mode: 'standard' }),
    })
  })

  it('sends feynman mode when specified', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'Feynman response' }),
    })

    const result = await ragChat('Explain gravity', 'feynman')
    expect(result).toBe('Feynman response')

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.mode).toBe('feynman')
  })

  it('defaults mode to standard', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'answer' }),
    })

    await ragChat('question')

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.mode).toBe('standard')
  })

  it('throws on non-OK response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Server error',
    })

    await expect(ragChat('question')).rejects.toThrow('Server error')
  })

  it('returns empty string if no answer field', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ something: 'else' }),
    })

    const result = await ragChat('question')
    expect(result).toBe('')
  })

  it('throws on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Timeout'))

    await expect(ragChat('question')).rejects.toThrow('Timeout')
  })
})
