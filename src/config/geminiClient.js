
const runChat = async (messages) => {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Server error');
  }
  const data = await res.json();
  return data.reply || data.text || '';
}

export const uploadPdfs = async (files) => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Upload failed');
  }
  return await res.json();
}

// CHANGED: ragChat now accepts an optional mode param ("standard" | "feynman")
export const ragChat = async (question, mode = "standard") => {
  const res = await fetch('/api/rag/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, mode }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Server error');
  }
  const data = await res.json();
  return data.answer || '';
}

export default runChat;