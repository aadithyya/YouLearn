from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import pdfplumber
import pytesseract
import io
from pdf2image import convert_from_bytes
from langchain_text_splitters import CharacterTextSplitter
from langchain_qdrant import QdrantVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
import os
import uuid

load_dotenv()

app = FastAPI(title="YouLearn RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global or file-scope initialization of embeddings and LLM
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def get_qdrant():
    return QdrantVectorStore(
        client=None, # It utilizes from_texts if needed, but we can initialize the store directly
        embedding=embeddings,
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
        collection_name="youlearn-rag"
    )

def get_llm():
    return ChatGroq(
        temperature=0,
        model_name="llama-3.1-8b-instant",
        groq_api_key=os.getenv("GROQ_API_KEY")
    )

# -------------------- PDF TEXT --------------------
def get_pdf_text(pdf_bytes, filename):
    text = ""
    extracted_text = ""

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf_reader:
        pages = pdf_reader.pages
        # Removed hardcoded Windows poppler path to rely on system PATH for macOS/Linux
        images = convert_from_bytes(pdf_bytes) 
        
        for i, page in enumerate(pages):
            page_text = page.extract_text()
            
            if page_text:
                extracted_text += page_text + "\n"
            else:
                # Removed hardcoded tesseract_cmd
                extracted_text += pytesseract.image_to_string(images[i]) + "\n"

    text += extracted_text
    return text

# -------------------- CHUNKING --------------------
def get_text_chunks(raw_data):
    text_splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    return text_splitter.split_text(raw_data)

@app.post("/api/rag/process-pdf")
async def process_pdf(file: UploadFile = File(...)):
    try:
        pdf_bytes = await file.read()
        raw_text = get_pdf_text(pdf_bytes, file.filename)
        
        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="No text extracted.")
            
        chunks = get_text_chunks(raw_text)
        
        if not chunks:
            raise HTTPException(status_code=400, detail="Chunking failed.")
            
        # Re-initialize or add to Qdrant
        QdrantVectorStore.from_texts(
            texts=chunks,
            embedding=embeddings,
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY"),
            collection_name="youlearn-rag"
        )
        
        # We can generate a quick summary or just return success
        return {"message": "PDF processed successfully!", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    messages: list

@app.post("/api/rag/chat")
async def chat(request: ChatRequest):
    try:
        if not request.messages or len(request.messages) == 0:
            raise HTTPException(status_code=400, detail="No messages provided")
            
        user_question = request.messages[-1].get("text") or request.messages[-1].get("content")
        if not user_question:
            raise HTTPException(status_code=400, detail="No text found in latest message")
            
        vectorstore = get_qdrant()
        llm = get_llm()
        
        # Retrieve relevant past memory
        docs = vectorstore.similarity_search(user_question, k=3)
        memory_context = "\n".join([doc.page_content for doc in docs])
        
        prompt = f"""
You are a helpful AI assistant.

Relevant context from documents and past conversation:
{memory_context}

Question:
{user_question}

Answer clearly and accurately:
"""
        response = llm.invoke(prompt)
        
        # Store conversation as memory
        vectorstore.add_texts([
            f"User: {user_question}",
            f"Bot: {response.content}"
        ])
        
        return {"reply": response.content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
