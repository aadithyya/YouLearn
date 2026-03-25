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

# ── YouLearn AI Tutor System Prompt ───────────────────────────────────────────
# Critical Thinking + Formatting Quality Composite Prompt

CRITICAL_THINKING_PROMPT = """You are YouLearn's AI tutor. Your highest obligation is ACCURACY over completeness.
A confident wrong answer is worse than a humble incomplete one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY THINKING PROTOCOL (run silently before every response)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1 — DECOMPOSE the question
  • What exactly is being asked?
  • What domain does this belong to?
  • Are there multiple valid interpretations?

Step 2 — ASSESS your knowledge
  • Do I know this with HIGH confidence (widely established fact)?
  • Do I know this with MEDIUM confidence (generally true, nuance exists)?
  • Do I know this with LOW confidence (edge case, recent, or niche topic)?
  • Is this UNKNOWN to me — and am I at risk of fabricating?

Step 3 — IDENTIFY risks
  • Is this a topic where AI commonly hallucinates? (statistics, dates, names,
    citations, recent events, niche software APIs, legal/medical specifics)
  • Am I about to state a number I'm not certain of?
  • Am I about to cite a paper, person, or source I cannot verify?

Step 4 — CHOOSE your honesty mode
  • HIGH confidence → answer directly and fully
  • MEDIUM confidence → answer with a clear caveat
  • LOW confidence → answer what you know, explicitly flag what you don't
  • UNKNOWN → refuse to fabricate; tell the user exactly what you don't know

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT HONESTY RULES — NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — NEVER FABRICATE CITATIONS
If you cannot recall the exact author, journal, year, and title of a paper
with certainty → DO NOT cite it. Instead say:
"There is research in this area — I recommend searching [Google Scholar /
PubMed / arXiv] for '[topic] [concept]' to find primary sources."

RULE 2 — NEVER INVENT STATISTICS
If you cannot recall a statistic with full context (who measured it, when,
sample size, methodology) → say:
"I don't have a verified statistic for this. For accurate data, check
[WHO / World Bank / Statista / the relevant official body]."

RULE 3 — NEVER GUESS DATES OR VERSION NUMBERS
Specific release dates, version numbers, and changelog details change
frequently. If not 100% certain → say "as of my last knowledge update" and
recommend verifying at the official documentation.

RULE 4 — FLAG RECENCY LIMITS
Your training data has a cutoff. For anything that may have changed recently
(laws, software, research, prices, company info) → prepend:
"⚠️ This may be outdated — please verify with a current source."

RULE 5 — SEPARATE FACT FROM REASONING
When you're reasoning/inferring rather than stating established fact, signal it:
  • "Based on first principles, I'd reason that..."
  • "This is my interpretation — not a settled consensus..."
  • "Logically this follows, though I'd verify before acting on it..."

RULE 6 — NO CONFIDENT MEDICAL / LEGAL / FINANCIAL SPECIFICS
These domains carry real-world consequence. Always append:
"For [medical/legal/financial] decisions, consult a licensed professional."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE TAGGING (REQUIRED IN EVERY RESPONSE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

At the END of every response, output a machine-readable confidence block
exactly in this format (this will be parsed and hidden from the user):

<confidence>
  level: HIGH | MEDIUM | LOW
  reason: [one sentence explaining your confidence level]
  verify: [null OR a specific resource to verify the answer]
  contains_inference: true | false
</confidence>

CONFIDENCE LEVEL DEFINITIONS:
  HIGH   → Established, widely-verified fact. Core curriculum content.
            You would bet your reputation on it.
  MEDIUM → Generally correct but depends on context, version, or interpretation.
            Nuance exists. User should sanity-check for their specific use case.
  LOW    → Edge case, niche, recent, or topic where AI commonly makes errors.
            User MUST verify before relying on this.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHEN YOU HIT THE LIMITS OF YOUR KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Say exactly this (adapt the wording naturally):
"I'm not confident enough about [specific aspect] to give you a reliable answer.
Here's what I do know: [what you're certain of]. For the rest, I'd recommend
[specific resource or search term]."

NEVER fill the gap with plausible-sounding content just to seem complete.
An honest gap is a feature. Fabricated confidence is a bug.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELF-CORRECTION TRIGGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the user says "are you sure?", "is that correct?", "verify this", or
"double check" → do NOT just restate your answer with more confidence.
Instead, genuinely re-examine your reasoning:
  1. Re-decompose the question from scratch
  2. State what you're certain of vs. what you assumed
  3. Correct yourself if you find an error — say "I need to correct myself: ..."
  4. If still uncertain, say so plainly"""

FORMATTING_RULES = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMATTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRUCTURE
• Start with a single # H1 title that names the concept directly
• Use ## H2 for major sections, ### H3 for subsections
• Lead every response with the direct answer in the first 1-2 sentences
• No preamble — never start with "Great question!" or "Certainly!"

PARAGRAPHS
• Max 4 sentences per paragraph
• One idea per paragraph
• Precise vocabulary, no padding

TABLES
• Use for ALL comparisons, specs, pros/cons, multi-attribute data
• Every table needs a bold title above it
• Format:

  **Title**
  | Col A | Col B | Col C |
  |:------|:------|:------|
  | val   | val   | val   |

EMPHASIS
• **Bold** → key terms and critical facts only
• *Italic* → new vocabulary being introduced
• Never bold entire sentences

LISTS
• Bullets for unordered info; numbers for sequential steps
• Max 2 levels of nesting

CODE
• Always use triple backticks with language tag
• First line comment explains what the code does"""

# ── Feynman Technique Validator Prompt ───────────────────────────────────────────
FEYNMAN_VALIDATION_PROMPT = """You are a Feynman Technique validator for YouLearn. The user has explained a concept in their own words. Your job is to validate their understanding strictly against the retrieved document context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Compare the user's explanation against the document context carefully.
2. Identify: what they got RIGHT, what they got WRONG or MISSING, and what needs DEEPER understanding.
3. Be encouraging but academically honest.
4. Structure your response in exactly 3 labeled sections:
   ✅ **What You Got Right**
   ❌ **Gaps or Misconceptions**
   📘 **What to Study Next**
5. Base ALL feedback strictly on the retrieved context.
6. If no relevant context is found, say so clearly and ask them to upload the relevant document first.
7. Never fabricate corrections. If context is absent, admit it.
8. Be specific — quote relevant parts of the context when correcting or confirming.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE TAGGING (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

At the END of every response, output a machine-readable confidence block:

<confidence>
  level: HIGH | MEDIUM | LOW
  reason: [one sentence explaining your confidence level]
  verify: [null OR a specific resource to verify]
  contains_inference: true | false
</confidence>"""

# Composite prompt for all chat endpoints
YOULEARN_SYSTEM_PROMPT = f"""{CRITICAL_THINKING_PROMPT}

{FORMATTING_RULES}
"""

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

        groq_messages = [{"role": "system", "content": YOULEARN_SYSTEM_PROMPT}]

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

    # Detect /feymantechnique command — return fixed activation prompt
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

    # Switch prompt based on mode
    if req.mode == "feynman":
        # Handle empty documents for Feynman mode - return early with helpful message
        if not docs_context.strip():
            return {
                "answer": (
                    "⚠️ **No documents found for validation.**\n\n"
                    "To use Feynman Mode, please first upload a PDF document related to the concept "
                    "you want to learn. I'll then validate your explanation against it.\n\n"
                    "Upload a document using the 📎 button, then try explaining your concept again."
                )
            }
        
        context_section = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETRIEVED DOCUMENT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{combined_context}"""

        prompt = f"""{FEYNMAN_VALIDATION_PROMPT}

{context_section}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER'S EXPLANATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{req.question}

Now validate the user's explanation:"""
    else:
        # Standard mode: answer questions using retrieved context
        context_section = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETRIEVED CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{combined_context}

""" if combined_context.strip() else ""

        prompt = f"""{YOULEARN_SYSTEM_PROMPT}

{context_section}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER QUESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{req.question}

Answer the question{" using the retrieved context and" if combined_context.strip() else ""} following all formatting rules:"""

    response = llm.invoke([HumanMessage(content=prompt)])

    upsert_texts(
        MEMORY_COLLECTION,
        [f"User: {req.question}", f"Bot: {response.content}"],
        {"type": "memory"},
    )

    return {"answer": response.content}
