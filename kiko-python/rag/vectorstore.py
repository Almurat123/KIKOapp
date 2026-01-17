"""
Lightweight Knowledge Base using OpenAI Embeddings
Replaces heavy sentence-transformers with OpenAI API
"""
import os
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings


class KnowledgeBase:
    def __init__(self, persist_directory: str = "./chroma_db"):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required for embeddings")
        
        # Use OpenAI's lightweight embedding model
        # text-embedding-3-small: $0.02 / 1M tokens, 1536 dimensions
        self.embedding_function = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=api_key
        )
        
        self.persist_directory = persist_directory
        self.vectorstore = Chroma(
            persist_directory=persist_directory,
            embedding_function=self.embedding_function,
            collection_name="kiko_knowledge"
        )

    def query_with_score(self, query_text: str, k: int = 4):
        results = self.vectorstore.similarity_search_with_score(query_text, k=k)
        return results

    def query(self, query_text: str, k: int = 4):
        results = self.vectorstore.similarity_search(query_text, k=k)
        return results

    def add_documents(self, texts, metadatas=None):
        self.vectorstore.add_texts(texts, metadatas=metadatas)

    def ingest_documents(self, documents):
        """Add LangChain Document objects to the vectorstore."""
        self.vectorstore.add_documents(documents)
