import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createProxyMiddleware } from 'http-proxy-middleware'
import multer from 'multer'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

dotenv.config()

const app = express()
app.use(cors())

// Proxy to Python FastAPI backend. Placed before express.json() to not consume multipart streams.
app.use('/api/rag', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
}))

app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

const PORT = process.env.PORT || 5178
const API_KEY = process.env.GROQ_API_KEY

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

app.post('/api/summarize-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    if (!API_KEY) {
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
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }]
      })
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

app.listen(PORT, () =>
  console.log(`proxy running on http://localhost:${PORT}`)
)