import pytest
from fastapi.testclient import TestClient
from main import app
import os

client = TestClient(app)

def test_01_verify_api_env_keys():
    assert os.getenv("GROQ_API_KEY") is not None, "Missing GROQ_API_KEY"

def test_02_basic_chat_response():
    payload = {
        "messages": [
            {"role": "user", "text": "What is 2 + 2? Reply with just the number."}
        ]
    }
    
    chat_response = client.post("/api/chat", json=payload)
    assert chat_response.status_code == 200, chat_response.text
    reply = chat_response.json().get("reply", "")
    assert len(reply) > 0, "LLM returned an empty response"
    assert "4" in reply, f"LLM gave an incorrect answer: {reply}"
