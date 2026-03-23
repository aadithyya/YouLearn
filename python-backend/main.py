from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = FastAPI(title="YouLearn Core Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_client():
    return Groq()

class Message(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: List[Message]

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        if not request.messages or len(request.messages) == 0:
            raise HTTPException(status_code=400, detail="No messages provided")

        groq_messages = [{"role": "system", "content": "You are a helpful AI assistant."}]

        for msg in request.messages:
            if msg.role == "user":
                groq_messages.append({"role": "user", "content": msg.text})
            elif msg.role == "ai":
                groq_messages.append({"role": "assistant", "content": msg.text})

        client = get_client()
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=groq_messages,
            temperature=1,
            max_completion_tokens=8192,
            top_p=1,
            stream=False,
            stop=None
        )

        reply = completion.choices[0].message.content
        return {"reply": reply}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
