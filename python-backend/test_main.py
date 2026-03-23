import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)

@patch('main.get_client')
def test_chat_success(mock_get_client):
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Hello! How can I help you?"
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion
    mock_get_client.return_value = mock_client

    payload = {
        "messages": [
            {"role": "user", "text": "Hello"}
        ]
    }
    
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    assert response.json() == {"reply": "Hello! How can I help you?"}
    
    mock_client.chat.completions.create.assert_called_once()
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["model"] == "openai/gpt-oss-120b"
    assert call_kwargs["messages"][0]["role"] == "system"
    assert call_kwargs["messages"][1]["content"] == "Hello"

def test_chat_no_messages():
    payload = {"messages": []}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 400
    assert "No messages provided" in response.json()["detail"]
