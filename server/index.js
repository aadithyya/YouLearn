import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

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

app.listen(PORT, () =>
  console.log(`proxy running on http://localhost:${PORT}`)
)