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

// ─── Tests ──────────────────────────────────────────────────────

describe('Server API Endpoints', () => {
  beforeEach(() => {
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ── /api/gemini ──

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
      const res = await request(app)
        .post('/api/gemini')
        .send({ prompt: 'Hi' })

      expect(res.status).toBe(200)
      expect(res.body.reply).toBe('Hello from AI')
    })

    it('returns error when API key is missing', async () => {
      const app = createApp(null)
      const res = await request(app)
        .post('/api/gemini')
        .send({ prompt: 'Hi' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('GROQ_API_KEY is not set in .env')
    })

    it('returns error when Groq API responds with non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      })

      const app = createApp()
      const res = await request(app)
        .post('/api/gemini')
        .send({ prompt: 'Hi' })

      expect(res.status).toBe(429)
      expect(res.body.error).toBe('Rate limit exceeded')
    })

    it('returns "No response" when choices are empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      })

      const app = createApp()
      const res = await request(app)
        .post('/api/gemini')
        .send({ prompt: 'Hi' })

      expect(res.status).toBe(200)
      expect(res.body.reply).toBe('No response')
    })

    it('returns 500 on internal exception', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const app = createApp()
      const res = await request(app)
        .post('/api/gemini')
        .send({ prompt: 'Hi' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Network error')
    })
  })
})
