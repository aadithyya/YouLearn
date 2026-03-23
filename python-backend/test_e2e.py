import pytest
from fastapi.testclient import TestClient
from main import app
import os

client = TestClient(app)

def test_01_verify_api_env_keys():
    assert os.getenv("GROQ_API_KEY") is not None, "Missing GROQ_API_KEY"

def test_02_conversational_memory():
    payload = {
        "messages": [
            {"role": "user", "text": "I want you to remember that my favorite color is neon green."},
            {"role": "ai", "text": "I have stored your color neon green."},
            {"role": "user", "text": "What is my favorite color?"}
        ]
    }
    
    chat_response = client.post("/api/chat", json=payload)
    assert chat_response.status_code == 200, chat_response.text
    reply = chat_response.json().get("reply", "")
    
    assert "neon green" in reply.lower() or "green" in reply.lower(), "LLM failed to utilize conversational memory across standard context array."
