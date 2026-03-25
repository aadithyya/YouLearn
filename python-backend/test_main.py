import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)

# ── /api/chat Tests ───────────────────────────────────────────────

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

@patch('main.get_client')
def test_chat_multiple_messages(mock_get_client):
    """Test that multiple user and AI messages are relayed correctly."""
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Follow-up response"
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion
    mock_get_client.return_value = mock_client

    payload = {
        "messages": [
            {"role": "user", "text": "Hello"},
            {"role": "ai", "text": "Hi there!"},
            {"role": "user", "text": "Tell me about Python"}
        ]
    }
    
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200

    call_kwargs = mock_client.chat.completions.create.call_args[1]
    # System prompt + 3 messages
    assert len(call_kwargs["messages"]) == 4
    assert call_kwargs["messages"][1]["role"] == "user"
    assert call_kwargs["messages"][1]["content"] == "Hello"
    assert call_kwargs["messages"][2]["role"] == "assistant"
    assert call_kwargs["messages"][2]["content"] == "Hi there!"
    assert call_kwargs["messages"][3]["content"] == "Tell me about Python"

@patch('main.get_client')
def test_chat_api_error(mock_get_client):
    """Test handling of API client errors."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("API Error")
    mock_get_client.return_value = mock_client

    payload = {"messages": [{"role": "user", "text": "Hello"}]}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 500
    assert "API Error" in response.json()["detail"]

def test_chat_invalid_payload():
    """Test with completely invalid payload."""
    response = client.post("/api/chat", json={"invalid": "data"})
    assert response.status_code == 422  # Pydantic validation error

@patch('main.get_client')
def test_chat_system_prompt_is_first(mock_get_client):
    """Verify the system prompt is always the first message."""
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Response"
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion
    mock_get_client.return_value = mock_client

    payload = {"messages": [{"role": "user", "text": "Hi"}]}
    client.post("/api/chat", json=payload)

    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["messages"][0]["role"] == "system"
    assert "ACCURACY" in call_kwargs["messages"][0]["content"]

# ── /api/rag/chat Tests ───────────────────────────────────────────

@patch('main.get_rag_llm')
@patch('main.search_context')
@patch('main.upsert_texts')
def test_rag_chat_feynman_command(mock_upsert, mock_search, mock_llm):
    """Test /feymantechnique command returns activation prompt."""
    payload = {"question": "/feymantechnique", "mode": "standard"}
    response = client.post("/api/rag/chat", json=payload)
    
    assert response.status_code == 200
    answer = response.json()["answer"]
    assert "Feynman Mode activated" in answer
    assert "validate your understanding" in answer

@patch('main.get_rag_llm')
@patch('main.search_context')
@patch('main.upsert_texts')
def test_rag_chat_feynman_command_case_insensitive(mock_upsert, mock_search, mock_llm):
    """Test /feymantechnique command is case-insensitive."""
    payload = {"question": "/FEYMANTECHNIQUE", "mode": "standard"}
    response = client.post("/api/rag/chat", json=payload)
    
    assert response.status_code == 200
    assert "Feynman Mode activated" in response.json()["answer"]

@patch('main.get_rag_llm')
@patch('main.search_context')
@patch('main.upsert_texts')
def test_rag_chat_standard_mode(mock_upsert, mock_search, mock_llm):
    """Test standard RAG chat."""
    mock_search.return_value = "Python is a programming language."
    
    mock_llm_instance = MagicMock()
    mock_llm_instance.invoke.return_value.content = "Python is great for beginners."
    mock_llm.return_value = mock_llm_instance

    payload = {"question": "What is Python?", "mode": "standard"}
    response = client.post("/api/rag/chat", json=payload)
    
    assert response.status_code == 200
    assert response.json()["answer"] == "Python is great for beginners."

@patch('main.get_rag_llm')
@patch('main.search_context')
@patch('main.upsert_texts')
def test_rag_chat_feynman_mode_no_docs(mock_upsert, mock_search, mock_llm):
    """Test feynman mode returns warning when no documents are uploaded."""
    mock_search.return_value = ""

    payload = {"question": "Explain gravity", "mode": "feynman"}
    response = client.post("/api/rag/chat", json=payload)
    
    assert response.status_code == 200
    answer = response.json()["answer"]
    assert "No documents found" in answer

@patch('main.get_rag_llm')
@patch('main.search_context')
@patch('main.upsert_texts')
def test_rag_chat_feynman_mode_with_docs(mock_upsert, mock_search, mock_llm):
    """Test feynman mode with document context validates explanation."""
    mock_search.return_value = "Gravity is a fundamental force of attraction."
    
    mock_llm_instance = MagicMock()
    mock_llm_instance.invoke.return_value.content = "Your explanation is mostly correct."
    mock_llm.return_value = mock_llm_instance

    payload = {"question": "Gravity pulls things down", "mode": "feynman"}
    response = client.post("/api/rag/chat", json=payload)
    
    assert response.status_code == 200
    assert response.json()["answer"] == "Your explanation is mostly correct."

@patch('main.get_rag_llm')
@patch('main.search_context')
@patch('main.upsert_texts')
def test_rag_chat_saves_to_memory(mock_upsert, mock_search, mock_llm):
    """Test that RAG chat saves conversation to memory collection."""
    mock_search.return_value = "Some context"
    
    mock_llm_instance = MagicMock()
    mock_llm_instance.invoke.return_value.content = "AI response"
    mock_llm.return_value = mock_llm_instance

    payload = {"question": "Test question", "mode": "standard"}
    client.post("/api/rag/chat", json=payload)
    
    # Verify upsert_texts was called to save to memory
    mock_upsert.assert_called_once()
    call_args = mock_upsert.call_args
    assert call_args[0][0] == "youlearn_memory"
    assert any("Test question" in t for t in call_args[0][1])

def test_rag_chat_default_mode():
    """Test that mode defaults to 'standard'."""
    with patch('main.search_context', return_value="context"), \
         patch('main.get_rag_llm') as mock_llm, \
         patch('main.upsert_texts'):
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value.content = "Response"
        mock_llm.return_value = mock_llm_instance

        payload = {"question": "Hello"}  # No mode specified
        response = client.post("/api/rag/chat", json=payload)
        assert response.status_code == 200

# ── Utility Function Tests ────────────────────────────────────────

def test_get_text_chunks():
    """Test text chunking function."""
    from main import get_text_chunks
    
    # CharacterTextSplitter uses "\n" as separator, so create newline-separated text
    text = "\n".join(["Line " + str(i) + " " + "x" * 80 for i in range(30)])
    chunks = get_text_chunks(text)
    assert len(chunks) >= 2

def test_get_text_chunks_short_text():
    """Test that short text is not split."""
    from main import get_text_chunks
    
    text = "Short text."
    chunks = get_text_chunks(text)
    assert len(chunks) == 1
    assert chunks[0] == "Short text."

def test_get_text_chunks_empty():
    """Test empty text returns empty list."""
    from main import get_text_chunks
    
    chunks = get_text_chunks("")
    assert len(chunks) == 0

# ── Model Validation Tests ────────────────────────────────────────

def test_message_model():
    """Test Message Pydantic model."""
    from main import Message
    msg = Message(role="user", text="Hello")
    assert msg.role == "user"
    assert msg.text == "Hello"

def test_chat_request_model():
    """Test ChatRequest Pydantic model."""
    from main import ChatRequest
    req = ChatRequest(messages=[{"role": "user", "text": "Hi"}])
    assert len(req.messages) == 1
    assert req.messages[0].role == "user"

def test_rag_chat_request_model_defaults():
    """Test RagChatRequest default mode."""
    from main import RagChatRequest
    req = RagChatRequest(question="Test")
    assert req.mode == "standard"

def test_rag_chat_request_model_feynman():
    """Test RagChatRequest with feynman mode."""
    from main import RagChatRequest
    req = RagChatRequest(question="Test", mode="feynman")
    assert req.mode == "feynman"
