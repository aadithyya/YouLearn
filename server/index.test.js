import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}))

const originalFetch = globalThis.fetch
let mockFetch

function createApp(apiKey = 'test-api-key') {
  const app = express()
  app.use(express.json())

  // /api/chat → relay to FastAPI
  app.post('/api/chat', async (req, res) => {
    try {
      const upstream = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      const data = await upstream.json()
      res.status(upstream.status).json(data)
    } catch (err) {
      res.status(502).json({ error: 'Could not reach backend: ' + err.message })
    }
  })

  // /api/gemini → direct Groq call
  app.post('/api/gemini', async (req, res) => {
    try {
      const prompt = req.body.prompt

      if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not set in .env' })
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return res.status(response.status).json({ error: data?.error?.message || 'Groq API error' })
      }

      const reply = data?.choices?.[0]?.message?.content || 'No response'
      res.json({ reply })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return app
}

describe('Server API Endpoints', () => {
  beforeEach(() => {
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('POST /api/chat', () => {
    it('relays request to FastAPI and returns the reply', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ reply: 'Hello from FastAPI' }),
      })

      const app = createApp()
      const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', text: 'Hi' }] })

      expect(res.status).toBe(200)
      expect(res.body.reply).toBe('Hello from FastAPI')
      expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:8000/api/chat', expect.objectContaining({
        method: 'POST',
      }))
    })

    it('returns 502 when FastAPI is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const app = createApp()
      const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', text: 'Hi' }] })

      expect(res.status).toBe(502)
      expect(res.body.error).toContain('Could not reach backend')
    })

    it('passes FastAPI error status back to client', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'No messages provided' }),
      })

      const app = createApp()
      const res = await request(app).post('/api/chat').send({ messages: [] })

      expect(res.status).toBe(400)
      expect(res.body.detail).toBe('No messages provided')
    })
  })

  describe('POST /api/gemini', () => {
    it('returns AI reply on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Hello from AI' } }],
        }),
      })

      const app = createApp()
      const res = await request(app).post('/api/gemini').send({ prompt: 'Hi' })

      expect(res.status).toBe(200)
      expect(res.body.reply).toBe('Hello from AI')
    })

    it('returns error when API key is missing', async () => {
      const app = createApp(null)
      const res = await request(app).post('/api/gemini').send({ prompt: 'Hi' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('GROQ_API_KEY is not set in .env')
    })

    it('returns error when Groq responds with non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      })

      const app = createApp()
      const res = await request(app).post('/api/gemini').send({ prompt: 'Hi' })

      expect(res.status).toBe(429)
      expect(res.body.error).toBe('Rate limit exceeded')
    })

    it('returns 500 on network exception', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const app = createApp()
      const res = await request(app).post('/api/gemini').send({ prompt: 'Hi' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Network error')
    })

    it('returns No response when choices are empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      })

      const app = createApp()
      const res = await request(app).post('/api/gemini').send({ prompt: 'Hi' })

      expect(res.status).toBe(200)
      expect(res.body.reply).toBe('No response')
    })
  })
})
