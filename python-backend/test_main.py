import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)

@patch('main.get_llm')
def test_chat_success(mock_get_llm):
    mock_llm = MagicMock()
    mock_response = MagicMock()
    mock_response.content = "This is the native AI response."
    mock_llm.invoke.return_value = mock_response
    mock_get_llm.return_value = mock_llm

    payload = {
        "messages": [
            {"role": "user", "text": "Hello"}
        ]
    }
    
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    assert response.json() == {"reply": "This is the native AI response."}
    
    mock_llm.invoke.assert_called_once()
    llm_call_args = mock_llm.invoke.call_args[0][0]
    assert len(llm_call_args) == 2 
    assert "Hello" in llm_call_args[1].content

def test_chat_no_messages():
    payload = {"messages": []}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 400
    assert "No messages provided" in response.json()["detail"]
