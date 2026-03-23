
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
export default runChat;