from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

import os
import io
import uuid
import pdfplumber
import pytesseract

from pdf2image import convert_from_bytes
from langchain_text_splitters import CharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from groq import Groq
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

load_dotenv()

app = FastAPI(title="YouLearn Core Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Environment ───────────────────────────────────────────────────
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TESSERACT_CMD = os.getenv("TESSERACT_CMD")
POPPLER_PATH = os.getenv("POPPLER_PATH")

DOCS_COLLECTION = "youlearn_docs"
MEMORY_COLLECTION = "youlearn_memory"

if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# ── RAG Components ────────────────────────────────────────────────
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

EMBED_DIM = 384


def ensure_collection(name: str):
    if not qdrant.collection_exists(name):
        qdrant.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


ensure_collection(DOCS_COLLECTION)
ensure_collection(MEMORY_COLLECTION)


def get_pdf_text(pdf_bytes: bytes):
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf_reader:
            pages = pdf_reader.pages
            images = convert_from_bytes(pdf_bytes, poppler_path=POPPLER_PATH) if POPPLER_PATH else convert_from_bytes(pdf_bytes)

            for i, page in enumerate(pages):
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text += page_text + "\n"
                else:
                    if i < len(images):
                        text += pytesseract.image_to_string(images[i]) + "\n"
    except Exception as e:
        raise RuntimeError(f"PDF extraction failed: {str(e)}")
    return text


def get_text_chunks(raw_text: str):
    splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    return splitter.split_text(raw_text)


def upsert_texts(collection_name: str, texts: list, metadata: dict):
    if not texts:
        return
    vectors = embeddings.embed_documents(texts)
    points = []
    for text, vector in zip(texts, vectors):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                payload={"text": text, **metadata},
            )
        )
    qdrant.upsert(collection_name=collection_name, points=points)


def search_context(collection_name: str, query: str, limit: int = 4, filter_key: str = None):
    query_vector = embeddings.embed_query(query)
    search_results = qdrant.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=limit,
        with_payload=True,
    )
    texts = []
    for point in search_results:
        payload = point.payload or {}
        if filter_key is None or payload.get("type") == filter_key:
            t = payload.get("text")
            if t:
                texts.append(t)
    return "\n".join(texts)


def get_rag_llm():
    return ChatGroq(
        temperature=0,
        model_name="llama-3.1-8b-instant",
        groq_api_key=GROQ_API_KEY,
    )


def get_client():
    return Groq()


# ── Models ────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    messages: List[Message]


class RagChatRequest(BaseModel):
    question: str
    mode: str = "standard"  # values: "standard" | "feynman"


# ── Standard Chat Endpoint ────────────────────────────────────────
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
            stop=None,
        )

        reply = completion.choices[0].message.content
        return {"reply": reply}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_pdf(files: list[UploadFile] = File(...)):
    all_chunks = []

    for file in files:
        pdf_bytes = await file.read()
        raw_text = get_pdf_text(pdf_bytes)

        if raw_text.strip():
            chunks = get_text_chunks(raw_text)
            for chunk in chunks:
                all_chunks.append({
                    "text": chunk,
                    "metadata": {
                        "type": "doc",
                        "source": file.filename or "uploaded_pdf",
                    },
                })

    if not all_chunks:
        return {"error": "No text could be extracted from the uploaded PDFs"}

    for item in all_chunks:
        upsert_texts(DOCS_COLLECTION, [item["text"]], item["metadata"])

    return {"status": "PDFs processed successfully", "chunks_added": len(all_chunks)}


# ── RAG Chat Endpoint ────────────────────────────────────────────
@app.post("/api/rag/chat")
async def rag_chat(req: RagChatRequest):
    from langchain_core.messages import HumanMessage

    # CHANGED: Detect /feymantechnique command — return fixed activation prompt
    if req.question.strip().lower() == "/feymantechnique":
        return {
            "answer": (
                "🧠 **Feynman Mode activated.**\n\n"
                "Please explain the concept you want to master, "
                "as if you were teaching it to someone with no prior knowledge.\n\n"
                "I will listen, then validate your understanding against your documents."
            )
        }

    docs_context = search_context(DOCS_COLLECTION, req.question, limit=4, filter_key="doc")
    memory_context = search_context(MEMORY_COLLECTION, req.question, limit=4, filter_key="memory")

    combined_context = "\n\n".join(
        part for part in [docs_context, memory_context] if part.strip()
    )

    llm = get_rag_llm()

    # CHANGED: Switch prompt based on mode — feynman uses validation prompt
    if req.mode == "feynman":
        prompt = f"""
<system>
You are a Feynman Technique validator. The user has explained a concept
in their own words. Your job is to validate their understanding strictly
against the retrieved document context.
</system>

<retrieved_context>
{combined_context}
</retrieved_context>

<rules>
VALIDATION RULES:
- Compare the user's explanation against the document context carefully.
- Identify: what they got RIGHT, what they got WRONG or MISSING,
  and what needs DEEPER understanding.
- Be encouraging but academically honest.
- Structure your response in exactly 3 labeled sections:
    ✅ What You Got Right
    ❌ Gaps or Misconceptions
    📘 What to Study Next
- Base ALL feedback strictly on the retrieved context.
- If no relevant context is found, say so clearly and ask them to upload
  the relevant document first.
- Never fabricate corrections. If context is absent, admit it.
</rules>

<user_explanation>
{req.question}
</user_explanation>

Validate the explanation now:
""".strip()
    else:
        prompt = f"""
You are an expert AI tutor for YouLearn, an online learning platform. Your answers must be clear, structured, and easy to read. Follow every formatting rule below without exception.

────────────────────────────────
CORE FORMATTING RULES
────────────────────────────────

1. HEADINGS
   - Use ## for major sections, ### for subsections.
   - Never skip heading levels (do not jump from # to ###).
   - Headings must be concise — 2 to 6 words.
   - Always leave one blank line above and below every heading.

2. TABLES
   Use a markdown table whenever the content involves:
   - Comparing 2 or more items across shared attributes
   - Listing features, pros/cons, or specifications
   - Showing schedules, timelines, or structured data
   - Any response where columns and rows naturally exist

   Table formatting rules:
   - Always include a header row with bold column names.
   - Align columns cleanly using proper markdown pipe syntax.
   - Never substitute a table with a bullet list if a table fits.
   - Keep cell content short — elaborate in prose below the table.

3. LISTS
   - Use bullet lists ( - ) for unordered, non-sequential items.
   - Use numbered lists ( 1. ) only for steps or ranked items.
   - Never use a list if prose flows naturally (< 3 items = write as a sentence).
   - Each bullet must be at least one complete sentence.
   - Never nest more than 2 levels of bullets.

4. SPACING
   - Exactly one blank line between every section, list, table, and paragraph.
   - No double blank lines anywhere.
   - No trailing spaces.
   - Code blocks must have one blank line above and below.

5. CODE
   - Always wrap code in fenced code blocks with the language tag.
   - Example: ```python, ```javascript, ```sql
   - Inline code uses single backticks: `variable_name`
   - Never write code as plain text or inside bullet points.

6. BOLD & EMPHASIS
   - Bold ( **text** ) is for key terms, labels, and critical warnings only.
   - Italic ( *text* ) is for definitions or first-time introductions of a term.
   - Never bold entire sentences or headings.
   - Never use bold for decoration.

7. ANSWER LENGTH & STRUCTURE
   - Short factual question → 1–3 sentences. No headers needed.
   - Medium explanation → Use 1–2 ## sections with prose.
   - Complex or multi-part topic → Full structure: intro, ## sections, table if applicable, summary.
   - Always open with a direct answer to the question before elaborating.
   - End complex answers with a brief ## Summary or ## Key Takeaways section.

8. TONE
   - Be clear, confident, and educational — never condescending.
   - Write in second person: "You can..." not "One can..."
   - Avoid filler phrases: never start with "Certainly!", "Great question!", or "Of course!".
   - Be concise. Say exactly what needs to be said, nothing more.

────────────────────────────────
WHAT NOT TO DO
────────────────────────────────

✗ Do not use walls of bullet points instead of prose or tables.
✗ Do not add blank lines randomly or inconsistently.
✗ Do not use a heading for a one-line answer.
✗ Do not repeat the user's question back to them.
✗ Do not use ALL CAPS for emphasis — use bold instead.
✗ Do not mix heading levels without logical hierarchy.
✗ Do not add filler disclaimers like "I hope this helps!" at the end.

────────────────────────────────
YOULEARN CONTEXT
────────────────────────────────

Students come to YouLearn to understand concepts deeply and efficiently. Every answer you write should feel like it was crafted by the world's clearest teacher — organized, visual where appropriate, and respectful of the student's time. Formatting is not decoration; it is part of the learning experience.

────────────────────────────────
RETRIEVED CONTEXT
────────────────────────────────
{combined_context}

────────────────────────────────
USER QUESTION
────────────────────────────────
{req.question}

Think briefly about the question type, apply the core formatting rules, then answer:
""".strip()

    response = llm.invoke([HumanMessage(content=prompt)])

    upsert_texts(
        MEMORY_COLLECTION,
        [f"User: {req.question}", f"Bot: {response.content}"],
        {"type": "memory"},
    )

    return {"answer": response.content}
