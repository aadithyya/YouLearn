from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

load_dotenv()

app = FastAPI(title="YouLearn Core Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_llm():
    return ChatGroq(temperature=0, model_name="llama-3.1-8b-instant")

class Message(BaseModel):
    role: str
    text: str
    isPdf: bool = False

class ChatRequest(BaseModel):
    messages: List[Message]

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        if not request.messages or len(request.messages) == 0:
            raise HTTPException(status_code=400, detail="No messages provided")

        system_prompt = "You are a helpful AI assistant."
        llm_messages = [SystemMessage(content=system_prompt)]

        for msg in request.messages:
            if msg.role == "user":
                llm_messages.append(HumanMessage(content=msg.text))
            elif msg.role == "ai":
                llm_messages.append(AIMessage(content=msg.text))

        llm = get_llm()
        response = llm.invoke(llm_messages)
        
        return {"reply": response.content}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
