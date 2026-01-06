from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
from rag.crawler import Web3DocCrawler
from rag.vectorstore import KnowledgeBase
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader, UnstructuredMarkdownLoader
import os

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'kiko-api', '.env')
print(f"DEBUG: Loading .env from {dotenv_path}")
load_dotenv(dotenv_path)
print(f"DEBUG: OPENAI_API_KEY present: {bool(os.getenv('OPENAI_API_KEY'))}")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="KiKo RAG Service")

# Initialize components
crawler = Web3DocCrawler()
kb = KnowledgeBase()

class IngestRequest(BaseModel):
    url: str
    max_depth: int = 3
    exclude_dirs: Optional[List[str]] = None

class LocalIngestRequest(BaseModel):
    path: str
    glob: str = "**/*.md"


class QueryRequest(BaseModel):
    query: str
    k: int = 4

class QueryResponse(BaseModel):
    results: List[dict]

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/ingest")
async def ingest_docs(request: IngestRequest, background_tasks: BackgroundTasks):
    """
    Trigger ingestion of a documentation site.
    Runs in background to avoid blocking.
    """
    background_tasks.add_task(process_ingestion, request.url, request.max_depth, request.exclude_dirs)
    return {"status": "accepted", "message": f"Started ingestion for {request.url}"}

@app.post("/ingest-local")
async def ingest_local(request: LocalIngestRequest, background_tasks: BackgroundTasks):
    """
    Trigger ingestion of local directory.
    """
    background_tasks.add_task(process_local_ingestion, request.path, request.glob)
    return {"status": "accepted", "message": f"Started local ingestion for {request.path}"}


async def process_ingestion(url: str, max_depth: int, exclude_dirs: List[str] = None):
    try:
        logger.info(f"Processing ingestion for {url}")
        docs = await crawler.crawl_recursive(url, max_depth, exclude_dirs)
        
        if not docs:
            logger.warning(f"No valid docs found for {url}")
            return
            
        kb.ingest_documents(docs)
        logger.info(f"Ingestion successful for {url}")
    except Exception as e:
        logger.error(f"Ingestion failed for {url}: {e}")

async def process_local_ingestion(path: str, glob_pattern: str):
    try:
        logger.info(f"Processing local ingestion for {path}")
        if not os.path.exists(path):
            logger.error(f"Path does not exist: {path}")
            return
            
        # Use simple directory loader
        loader = DirectoryLoader(path, glob=glob_pattern)
        docs = loader.load()
        
        if not docs:
            logger.warning(f"No documents found in {path} with glob {glob_pattern}")
            return
            
        kb.ingest_documents(docs)
        logger.info(f"Local ingestion successful for {path}")
    except Exception as e:
        logger.error(f"Local ingestion failed for {path}: {e}")


@app.post("/query", response_model=QueryResponse)
def query_knowledge(request: QueryRequest):
    """
    Retrieve relevant documents for a query.
    """
    try:
        results = kb.query_with_score(request.query, k=request.k)
        
        # Format for response
        formatted_results = []
        for doc, score in results:
            formatted_results.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": score
            })
            
        return {"results": formatted_results}
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
