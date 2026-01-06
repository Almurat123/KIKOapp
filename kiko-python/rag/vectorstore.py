import os
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

class KnowledgeBase:
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.embedding_function = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L12-v2"
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
