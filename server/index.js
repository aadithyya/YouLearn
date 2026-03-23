import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createProxyMiddleware } from 'http-proxy-middleware'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 5178
const API_KEY = process.env.GROQ_API_KEY
const FASTAPI_URL = 'http://127.0.0.1:8000'

// ── /api/chat → forward directly to FastAPI ──────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const upstream = await fetch(`${FASTAPI_URL}/api/chat`, {
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

// ── /api/gemini → direct Groq call ──────────────────────────────
app.post('/api/gemini', async (req, res) => {
  try {
    const prompt = req.body.prompt

    if (!API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set in .env' })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }]
      })
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

app.listen(PORT, () =>
  console.log(`proxy running on http://localhost:${PORT}`)
)