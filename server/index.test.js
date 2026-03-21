import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import multer from 'multer'

// ─── Mocks ──────────────────────────────────────────────────────

vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}))

import pdfParse from 'pdf-parse'

// ─── Helpers ────────────────────────────────────────────────────

const originalFetch = globalThis.fetch
let mockFetch

function createApp(apiKey = 'test-api-key') {
  const app = express()
  app.use(express.json())

  const upload = multer({ storage: multer.memoryStorage() })

  // /api/gemini
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

  // /api/summarize-pdf
  app.post('/api/summarize-pdf', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not set in .env' })
      }

      const pdfData = await pdfParse(req.file.buffer)
      const text = pdfData.text

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'No readable text found in PDF' })
      }

      const prompt = `Summarize this academic content in structured format:
- Title
- Key Concepts
- Explanation
- Important Points

Content:
${text.slice(0, 6000)}`

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return res.status(response.status).json({ error: data?.error?.message || 'Groq API error' })
      }

      const summary = data?.choices?.[0]?.message?.content || 'No summary generated'
      res.json({ summary })
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
    pdfParse.mockReset()
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

  // ── /api/summarize-pdf ──

  describe('POST /api/summarize-pdf', () => {
    it('returns summary for a valid PDF', async () => {
      pdfParse.mockResolvedValueOnce({ text: 'Some academic content here' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '## Summary\nKey points here' } }],
        }),
      })

      const app = createApp()
      const res = await request(app)
        .post('/api/summarize-pdf')
        .attach('file', Buffer.from('fake pdf content'), 'test.pdf')

      expect(res.status).toBe(200)
      expect(res.body.summary).toBe('## Summary\nKey points here')
    })

    it('returns 400 when no file is uploaded', async () => {
      const app = createApp()
      const res = await request(app).post('/api/summarize-pdf')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('No file uploaded')
    })

    it('returns error when API key is missing', async () => {
      const app = createApp(null)
      const res = await request(app)
        .post('/api/summarize-pdf')
        .attach('file', Buffer.from('fake'), 'test.pdf')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('GROQ_API_KEY is not set in .env')
    })

    it('returns 400 when PDF has no readable text', async () => {
      pdfParse.mockResolvedValueOnce({ text: '   ' })

      const app = createApp()
      const res = await request(app)
        .post('/api/summarize-pdf')
        .attach('file', Buffer.from('fake'), 'test.pdf')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('No readable text found in PDF')
    })

    it('returns error when Groq API fails', async () => {
      pdfParse.mockResolvedValueOnce({ text: 'Some content' })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: { message: 'Groq internal error' } }),
      })

      const app = createApp()
      const res = await request(app)
        .post('/api/summarize-pdf')
        .attach('file', Buffer.from('fake'), 'test.pdf')

      expect(res.status).toBe(502)
      expect(res.body.error).toBe('Groq internal error')
    })

    it('returns 500 when pdf-parse throws (corrupted file)', async () => {
      pdfParse.mockRejectedValueOnce(new Error('Invalid PDF structure'))

      const app = createApp()
      const res = await request(app)
        .post('/api/summarize-pdf')
        .attach('file', Buffer.from('corrupted'), 'bad.pdf')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Invalid PDF structure')
    })

    it('returns "No summary generated" when Groq returns empty choices', async () => {
      pdfParse.mockResolvedValueOnce({ text: 'Some content' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      })

      const app = createApp()
      const res = await request(app)
        .post('/api/summarize-pdf')
        .attach('file', Buffer.from('fake'), 'test.pdf')

      expect(res.status).toBe(200)
      expect(res.body.summary).toBe('No summary generated')
    })
  })
})
