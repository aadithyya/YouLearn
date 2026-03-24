# YouLearn: Project Architecture & Technical Report

## 1. Project Overview
**YouLearn** is a full-stack, AI-powered study assistant application. It provides users with an intelligent chat interface capable of both standard conversational Q&A and **Retrieval-Augmented Generation (RAG)**. Users can upload PDF documents (including scanned documents, thanks to built-in OCR capability), and the application will extract, embed, and index the text. Users can then ask context-aware questions about their specific documents, complete with conversational memory.

---

## 2. Core Features
- **Standard AI Chat:** A fast, conversational LLM interface powered by Groq's `gpt-oss-120b` native SDK.
- **Document Processing & OCR:** Upload PDFs directly in the chat. Extracts text using `pdfplumber` and falls back to Google Tesseract OCR for scanned images using `pdf2image`.
- **Retrieval-Augmented Generation (RAG):** Context-aware chat using HuggingFace local embeddings (`all-MiniLM-L6-v2`) and the Qdrant Vector Database.
- **Persistent Conversational Memory:** Stores previous user-assistant interactions as vectors in Qdrant to maintain context over long study sessions.
- **Authentication:** Secure user login and session management powered by Clerk Authentication.
- **Modern UI:** A responsive React frontend built with Vite, featuring dynamic typing indicators, auto-scrolling, Markdown formatting, and a dedicated RAG-mode toggle.

---

## 3. Code Architecture: What It Does & How It Does It

The application operates on a 3-tier architecture:

### A. The Frontend (React + Vite)
Located in `src/`.
* **What it does:** Provides the graphical user interface, authenticates the user, handles user inputs/PDF uploads, and renders the AI's Markdown responses.
* **How it does it:**
  - **`Main.jsx`**: The core chat view. It maintains an array of `messages` in React state. It includes a file input (`<input type="file" />`) for PDFs. When PDFs are uploaded, it enables `ragMode`, changing the chat behavior to utilize context.
  - **`geminiClient.js`**: Reusable async helper functions (`runChat`, `uploadPdfs`, `ragChat`) that use `fetch()` to send data to the backend APIs.
  - **Clerk UI components**: `<UserButton />` and `useUser()` seamlessly inject authentication state into the navigation bar.

### B. The Proxy / BFF Layer (Node.js + Express)
Located in `server/index.js`.
* **What it does:** Acts as a Backend-For-Frontend (BFF) cross-origin relay. It bridges the Vite frontend (port 5173) and the Python backend (port 8000).
* **How it does it:**
  - Standard Vite proxy configurations (`http-proxy-middleware` v3) can sometimes strip routing paths, breaking requests. To guarantee stability, the Express server uses native async `fetch()` to relay `POST /api/chat`, `POST /api/upload`, and `POST /api/rag/chat` directly to FastAPI with the correct JSON and FormData payloads. It ensures CORS rules are satisfied for the browser.

### C. The Core AI Engine (Python + FastAPI)
Located in `python-backend/`. This is the brain of the application.

#### **Endpoint 1: Standard Chat (`/api/chat`)**
* **What it does:** Handles general-knowledge LLM requests without relying on uploaded PDFs.
* **How it does it:** Receives a history of JSON messages. It instantiates the native `Groq` Python client, streams the messages directly to the `openai/gpt-oss-120b` model, and returns the generated text.

#### **Endpoint 2: Document Processing (`/api/upload`)**
* **What it does:** Ingests PDF files, processes the text, and stores them via vector embeddings so the AI can "read" them later.
* **How it does it:** 
  1. **Extraction:** Opens the bytes using `pdfplumber`. If a page has no selectable text (like a scanned photo), it uses `pdf2image` to convert the page to an image, then runs `pytesseract` (Optical Character Recognition) to scrape the text from the image.
  2. **Chunking:** Passes the massive text string into LangChain's `CharacterTextSplitter`. Text is broken down into overlapping 1000-character chunks so it fits into the AI's context window.
  3. **Embedding & Storage:** Passes chunks through a HuggingFace embedding model (`all-MiniLM-L6-v2`) which translates text into High-Dimensional Vectors (arrays of 384 numbers). These vectors are then upserted into the `youlearn_docs` collection in the cloud Qdrant Vector database.

#### **Endpoint 3: RAG Chat (`/api/rag/chat`)**
* **What it does:** Answers user questions strictly based on the uploaded PDFs, while remembering previous questions.
* **How it does it:**
  1. **Vector Search:** Takes the user's question, turns it into a vector, and queries Qdrant for the top 4 most mathematically similar text chunks in both the `youlearn_docs` collection (the PDFs) and the `youlearn_memory` collection (past conversation history).
  2. **Prompt Construction:** Injects the retrieved chunks into a strict system prompt: *"Use the context below only if it is relevant. Context: [CHUNKS]"*
  3. **Generation:** Passes the prompt to an optimized LangChain `ChatGroq` wrapper (`llama-3.1-8b-instant`) to generate the final informed answer.
  4. **Memory Injection:** Automatically vectors the newly generated Question/Answer pair and saves it back into the `youlearn_memory` Qdrant collection for future turns.

---

## 4. Testing & Reliability
- **Frontend Whitebox Testing:** Powered by Vitest. Validates all React components (`Main`, `Sidebar`), routing payloads, and CSS formatter functions entirely in isolation (46 passing tests).
- **Backend Whitebox Testing:** Powered by Pytest. Validates the native Groq connection, vector environment variables, and memory-retention logic for continuous integration stability.
