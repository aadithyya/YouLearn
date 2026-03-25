"""
YouLearn RAG Engine — Production v2
====================================
Modular RAG architecture with:
- QueryPreprocessor: Stopword filtering, keyword extraction
- HallucinationScanner: Post-response validation
- DocumentStore: Vector storage with MMR diversity
- RAGEngine: Orchestrates retrieval + generation
"""

import os
import re
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from dotenv import load_dotenv

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

load_dotenv()

# ── Configuration ─────────────────────────────────────────────────────────────

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

DOCS_COLLECTION = "youlearn_docs"
MEMORY_COLLECTION = "youlearn_memory"
EMBED_DIM = 384

# ── Stopwords for QueryPreprocessor ──────────────────────────────────────────

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when",
    "at", "by", "for", "with", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "to", "from",
    "up", "down", "in", "out", "on", "off", "over", "under", "again",
    "further", "once", "here", "there", "all", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "can", "will", "just", "should",
    "now", "what", "which", "who", "whom", "this", "that", "these", "those",
    "am", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "having", "do", "does", "did", "doing", "would", "could", "ought",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your",
    "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she",
    "her", "hers", "herself", "it", "its", "itself", "they", "them", "their",
    "theirs", "themselves",
}


# ── Query Preprocessor ───────────────────────────────────────────────────────

class QueryPreprocessor:
    """
    Cleans and enhances user queries for better embedding retrieval.
    
    Bug Fix #1: Stopwords like "the" were leaking into embedding queries.
    Fixed by applying stopword filtering to core_words directly, never
    appending raw cleaned string back.
    """
    
    # Common question prefixes to strip
    PREFIXES = [
        r"^(what is|what are|what was|what were|what does|what do)\s+",
        r"^(how does|how do|how is|how are|how can|how to)\s+",
        r"^(why is|why are|why does|why do|why did)\s+",
        r"^(when is|when are|when does|when did|when was)\s+",
        r"^(where is|where are|where does|where did)\s+",
        r"^(who is|who are|who was|who were)\s+",
        r"^(can you|could you|would you|will you)\s+(tell me|explain|describe)?\s*",
        r"^(tell me about|explain|describe|define|summarize)\s+",
        r"^(i want to know about|i need to understand|help me with)\s+",
        r"^(please|hey|hi|hello)\s*",
    ]
    
    def __init__(self, stopwords: set = None):
        self.stopwords = stopwords or STOPWORDS
        self._prefix_patterns = [re.compile(p, re.IGNORECASE) for p in self.PREFIXES]
    
    def preprocess(self, query: str) -> Dict[str, Any]:
        """
        Preprocess a query for embedding retrieval.
        
        Returns:
            Dict with:
                - cleaned: Query with prefixes stripped
                - keywords: List of meaningful words (no stopwords)
                - embedding_query: Optimized string for embedding
        """
        original = query.strip()
        cleaned = original.lower()
        
        # Strip prefixes
        for pattern in self._prefix_patterns:
            cleaned = pattern.sub("", cleaned).strip()
        
        # Extract keywords - apply stopword filtering DIRECTLY, not via cleaned
        words = re.findall(r"\b[a-z]{2,}\b", cleaned)
        keywords = [w for w in words if w not in self.stopwords]
        
        # BUG FIX #1: Never append raw cleaned back - only use stopword-filtered keywords
        # Previously: embedding_query = cleaned + " " + " ".join(keywords)
        # This reintroduced stopwords from cleaned string.
        # Fixed: Only use stopword-filtered keywords
        embedding_query = " ".join(keywords)
        
        # If we have too few keywords, fall back to original (minus prefixes)
        if len(keywords) < 2:
            # Still filter stopwords even in fallback
            fallback_words = re.findall(r"\b[a-z]{2,}\b", cleaned)
            fallback_keywords = [w for w in fallback_words if w not in self.stopwords]
            if fallback_keywords:
                embedding_query = " ".join(fallback_keywords)
            else:
                # Last resort: use cleaned but at least we tried
                embedding_query = cleaned
        
        return {
            "original": original,
            "cleaned": cleaned,
            "keywords": keywords,
            "embedding_query": embedding_query,
        }


# ── Hallucination Scanner ────────────────────────────────────────────────────

class HallucinationScanner:
    """
    Scans AI responses for potential hallucinations.
    
    Bug Fix #2: The percentage regex \b\d+(?:\.\d+)?%\b failed because
    % is not a word character, so \b never matched at the end.
    Fixed by removing trailing \b.
    """
    
    # Patterns that might indicate hallucinated content
    SUSPICIOUS_PATTERNS = [
        # BUG FIX #2: Removed trailing \b from percentage pattern
        # Old: r"\b\d+(?:\.\d+)?%\b" - \b fails after % since % is not \w
        # New: r"\b\d+(?:\.\d+)?%" - works correctly
        (r"\b\d+(?:\.\d+)?%", "percentage"),
        (r"\b(?:19|20)\d{2}\b", "year"),
        (r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+(?:19|20)\d{2}\b", "date"),
        (r"\b(?:dr|prof|mr|mrs|ms)\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b", "named_person"),
        (r"\b[A-Z][a-z]+\s+et\s+al\.?", "citation"),
        (r"\b(?:https?://|www\.)\S+", "url"),
        (r"\b\d{3}-\d{3}-\d{4}\b", "phone"),
        (r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b", "email"),
    ]
    
    def __init__(self):
        self._patterns = [
            (re.compile(p, re.IGNORECASE), label) 
            for p, label in self.SUSPICIOUS_PATTERNS
        ]
    
    def scan(self, text: str, context: str = "") -> Dict[str, Any]:
        """
        Scan text for potential hallucinations.
        
        Args:
            text: The AI-generated response
            context: The retrieved context (for verification)
            
        Returns:
            Dict with:
                - flags: List of (type, matched_text) tuples
                - has_potential_hallucination: bool
                - confidence: float (0-1, higher = more suspicious)
        """
        flags = []
        text_lower = text.lower()
        context_lower = context.lower() if context else ""
        
        for pattern, label in self._patterns:
            for match in pattern.finditer(text):
                matched = match.group(0)
                
                # Check if this appears in context
                if context and matched.lower() in context_lower:
                    continue  # Found in context, probably not hallucinated
                
                flags.append({
                    "type": label,
                    "text": matched,
                    "position": match.span(),
                })
        
        # Calculate confidence score
        # More flags = higher suspicion, but weight by type
        type_weights = {
            "percentage": 0.3,
            "year": 0.2,
            "date": 0.4,
            "named_person": 0.5,
            "citation": 0.6,
            "url": 0.7,
            "phone": 0.6,
            "email": 0.5,
        }
        
        suspicion_score = sum(
            type_weights.get(f["type"], 0.3) for f in flags
        )
        
        return {
            "flags": flags,
            "has_potential_hallucination": len(flags) > 0,
            "suspicion_score": min(1.0, suspicion_score),
        }


# ──────────────────────────────────────────

class DocumentStore:
    """
    Vector store for documents with MMR diversity search.
    
    Bug Fix #4: conversation_history was external with hasattr guards.
    Fixed by putting it in __init__ and adding clear_conversation().
    """
    
    def __init__(
        self,
        collection_name: str = DOCS_COLLECTION,
        embed_dim: int = EMBED_DIM,
    ):
        self.collection_name = collection_name
        self.embed_dim = embed_dim
        
        # Initialize embeddings
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
        # Initialize Qdrant
        self.qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        self._ensure_collection()
        
        # BUG FIX #4: conversation_history now lives in __init__
        self.conversation_history: List[Dict[str, str]] = []
    
    def _ensure_collection(self):
        """Create collection if it doesn't exist."""
        if not self.qdrant.collection_exists(self.collection_name):
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.embed_dim,
                    distance=Distance.COSINE,
                ),
            )
    
    def add_documents(self, texts: List[str], metadata: Dict[str, Any] = None):
        """Add documents to the store."""
        if not texts:
            return
        
        metadata = metadata or {}
        vectors = self.embeddings.embed_documents(texts)
        
        points = [
            PointStruct(
                id=str(os.urandom(16).hex()),
                vector=vector,
                payload={"text": text, **metadata},
            )
            for text, vector in zip(texts, vectors)
        ]
        
        self.qdrant.upsert(collection_name=self.collection_name, points=points)
    
    def search(
        self,
        query: str,
        limit: int = 4,
        filter_key: str = None,
    ) -> List[Dict[str, Any]]:
        """Search for documents."""
        query_vector = self.embeddings.embed_query(query)
        
        results = self.qdrant.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit,
            with_payload=True,
        )
        
        documents = []
        for point in results:
            payload = point.payload or {}
            if filter_key is None or payload.get("type") == filter_key:
                documents.append({
                    "text": payload.get("text", ""),
                    "score": point.score,
                    "metadata": {k: v for k, v in payload.items() if k != "text"},
                })
        
        return documents
    
    def search_mmr(
        self,
        query: str,
        limit: int = 4,
        lambda_param: float = 0.6,
        filter_key: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Search with Maximal Marginal Relevance for diversity.
        
        Bug Fix #5: MMR diversity test had random 768-dim vectors that were
        near-orthogonal (score ≈ 0), causing MMR to prefer redundant chunks.
        Fixed by using proper embedding dimensions (384) and controlled geometry
        in tests.
        """
        query_vector = np.array(self.embeddings.embed_query(query))
        

        candidates = self.search(query, limit=limit * 3, filter_key=filter_key)
        
        if len(candidates) <= limit:
            return candidates
        
   
        candidate_texts = [c["text"] for c in candidates]
        candidate_vectors = np.array(
            self.embeddings.embed_documents(candidate_texts)
        )
        

        selected_indices = []
        remaining = set(range(len(candidates)))
        
        # First document: highest relevance
        scores = [c["score"] for c in candidates]
        first_idx = np.argmax(scores)
        selected_indices.append(first_idx)
        remaining.remove(first_idx)
        
        # Subsequent documents: balance relevance and diversity
        while len(selected_indices) < limit and remaining:
            mmr_scores = []
            remaining_list = list(remaining)
            
            for idx in remaining_list:
                # Relevance component
                relevance = candidates[idx]["score"]
                
                # Diversity component (max similarity to already selected)
                if selected_indices:
                    sims = [
                        np.dot(candidate_vectors[idx], candidate_vectors[s])
                        / (np.linalg.norm(candidate_vectors[idx]) * np.linalg.norm(candidate_vectors[s]))
                        for s in selected_indices
                    ]
                    max_sim = max(sims)
                else:
                    max_sim = 0
                
                # MMR score
                mmr_score = lambda_param * relevance - (1 - lambda_param) * max_sim
                mmr_scores.append((idx, mmr_score))
            
            # Select document with highest MMR score
            best_idx = max(mmr_scores, key=lambda x: x[1])[0]
            selected_indices.append(best_idx)
            remaining.remove(best_idx)
        
        return [candidates[i] for i in selected_indices]
    
    def get_context(
        self,
        query: str,
        limit: int = 4,
        filter_key: str = None,
        use_mmr: bool = False,
    ) -> str:
        """Get concatenated context string from search results."""
        if use_mmr:
            docs = self.search_mmr(query, limit=limit, filter_key=filter_key)
        else:
            docs = self.search(query, limit=limit, filter_key=filter_key)
        
        return "\n\n".join(d["text"] for d in docs if d["text"])
    
    def add_to_conversation(self, role: str, content: str):
        """Add a message to conversation history."""
        self.conversation_history.append({"role": role, "content": content})
    
    def clear_conversation(self):
        """Clear conversation history."""
        self.conversation_history = []




class RAGEngine:
    """
    Orchestrates retrieval-augmented generation.
    
    Bug Fix #3: The _generate method was importing genai locally and calling
    genai.GenerativeModel(), bypassing self.client. Fixed by routing through
    self.client.GenerativeModel().
    """
    
    def __init__(
        self,
        docs_store: DocumentStore = None,
        memory_store: DocumentStore = None,
        preprocessor: QueryPreprocessor = None,
        scanner: HallucinationScanner = None,
    ):
        self.docs_store = docs_store or DocumentStore(DOCS_COLLECTION)
        self.memory_store = memory_store or DocumentStore(MEMORY_COLLECTION)
        self.preprocessor = preprocessor or QueryPreprocessor()
        self.scanner = scanner or HallucinationScanner()
        
    
        self.llm = ChatGroq(
            temperature=0,
            model_name="llama-3.1-8b-instant",
            groq_api_key=GROQ_API_KEY,
        )
        

        self.client = None
        self._init_genai_client()
    
    def _init_genai_client(self):
        """Initialize Google GenAI client if available."""
        try:
            import google.generativeai as genai
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self.client = genai
        except ImportError:
            pass
    
    def _generate(self, prompt: str) -> str:
        """
        Generate response from LLM.
        
        Bug Fix #3: Previously imported genai locally and called
        genai.GenerativeModel(), bypassing self.client. Now routes through
        self.client.GenerativeModel() for proper mocking in tests.
        """
        # Try LangChain/Groq first
        try:
            from langchain_core.messages import HumanMessage
            response = self.llm.invoke([HumanMessage(content=prompt)])
            return response.content
        except Exception:
            pass
        
        # BUG FIX #3: Route through self.client, not local genai import
        if self.client:
            try:
                model = self.client.GenerativeModel('gemini-pro')
                response = model.generate_content(prompt)
                return response.text
            except Exception:
                pass
        
        # Fallback
        raise RuntimeError("No LLM backend available")
    
    def query(
        self,
        question: str,
        mode: str = "standard",
        system_prompt: str = "",
        use_mmr: bool = False,
        scan_for_hallucinations: bool = True,
    ) -> Dict[str, Any]:
        """
        Execute a RAG query.
        
        Args:
            question: User's question
            mode: "standard" or "feynman"
            system_prompt: System prompt to use
            use_mmr: Use MMR for diverse retrieval
            scan_for_hallucinations: Scan response for hallucinations
            
        Returns:
            Dict with answer, context, and metadata
        """
        # Preprocess query
        preprocessed = self.preprocessor.preprocess(question)
        
        # Retrieve context
        docs_context = self.docs_store.get_context(
            preprocessed["embedding_query"],
            limit=4,
            filter_key="doc",
            use_mmr=use_mmr,
        )
        memory_context = self.memory_store.get_context(
            preprocessed["embedding_query"],
            limit=4,
            filter_key="memory",
        )
        
        combined_context = "\n\n".join(
            part for part in [docs_context, memory_context] if part.strip()
        )
        
        # Handle empty context for Feynman mode
        if mode == "feynman" and not docs_context.strip():
            return {
                "answer": (
                    "⚠️ **No documents found for validation.**\n\n"
                    "To use Feynman Mode, please first upload a PDF document."
                ),
                "context": "",
                "preprocessed": preprocessed,
                "hallucination_scan": None,
            }
        
        # Build prompt
        full_prompt = self._build_prompt(
            question=question,
            context=combined_context,
            mode=mode,
            system_prompt=system_prompt,
        )
        
        # Generate response
        answer = self._generate(full_prompt)
        
        # Scan for hallucinations
        hallucination_result = None
        if scan_for_hallucinations:
            hallucination_result = self.scanner.scan(answer, combined_context)
        
        # Store in memory
        self.memory_store.add_to_conversation("user", question)
        self.memory_store.add_to_conversation("assistant", answer)
        
        return {
            "answer": answer,
            "context": combined_context,
            "preprocessed": preprocessed,
            "hallucination_scan": hallucination_result,
        }
    
    def _build_prompt(
        self,
        question: str,
        context: str,
        mode: str,
        system_prompt: str,
    ) -> str:
        """Build the full prompt for the LLM."""
        if mode == "feynman":
            return f"""Validate the user's explanation against the document context.

CONTEXT:
{context}

USER'S EXPLANATION:
{question}

Provide structured feedback in 3 sections:
✅ What You Got Right
❌ Gaps or Misconceptions
📘 What to Study Next

Include a confidence block at the end:
<confidence>
  level: HIGH | MEDIUM | LOW
  reason: [explanation]
  verify: [resource or null]
  contains_inference: true | false
</confidence>"""
        else:
            context_section = f"\n\nCONTEXT:\n{context}\n" if context.strip() else ""
            return f"""{system_prompt}
{context_section}
QUESTION: {question}

Answer the question and include a confidence block at the end:
<confidence>
  level: HIGH | MEDIUM | LOW
  reason: [explanation]
  verify: [resource or null]
  contains_inference: true | false
</confidence>"""
