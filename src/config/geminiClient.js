
async function runChat(prompt) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Server error');
  }
  const data = await res.json();
  return data.reply || data.text || '';
}
export default runChat;