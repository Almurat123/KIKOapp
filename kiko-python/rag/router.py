from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
from pathlib import Path
from rag.crawler import Web3DocCrawler
from rag.vectorstore import KnowledgeBase
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader
from chat_v2.auth import require_internal_service

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'kiko-api', '.env')
load_dotenv(dotenv_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="KiKo RAG Service")

# Initialize components
crawler = Web3DocCrawler()
kb = KnowledgeBase()
_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_ALLOWED_LOCAL_ROOTS = [
    (_REPO_ROOT / "docs").resolve(),
    (_REPO_ROOT / "llmdoc").resolve(),
    (_REPO_ROOT / "kiko-api" / "docs").resolve(),
]


def _allowed_local_roots() -> list[Path]:
    configured = os.getenv("RAG_ALLOWED_LOCAL_ROOTS", "").strip()
    if not configured:
        return _DEFAULT_ALLOWED_LOCAL_ROOTS

    roots: list[Path] = []
    for item in configured.split(","):
        trimmed = item.strip()
        if trimmed:
            roots.append(Path(trimmed).resolve())
    return roots or _DEFAULT_ALLOWED_LOCAL_ROOTS


def _is_allowed_local_path(path: Path) -> bool:
    resolved = path.resolve()
    for root in _allowed_local_roots():
        try:
            resolved.relative_to(root)
            return True
        except ValueError:
            continue
    return False

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

@app.post("/ingest", dependencies=[Depends(require_internal_service)])
async def ingest_docs(request: IngestRequest, background_tasks: BackgroundTasks):
    """
    Trigger ingestion of a documentation site.
    Runs in background to avoid blocking.
    """
    background_tasks.add_task(process_ingestion, request.url, request.max_depth, request.exclude_dirs)
    return {"status": "accepted", "message": f"Started ingestion for {request.url}"}

@app.post("/ingest-local", dependencies=[Depends(require_internal_service)])
async def ingest_local(request: LocalIngestRequest, background_tasks: BackgroundTasks):
    """
    Trigger ingestion of local directory.
    """
    target_path = Path(request.path).resolve()
    if not _is_allowed_local_path(target_path):
        raise HTTPException(status_code=403, detail="Local ingestion path is not allowed")
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
        resolved_path = Path(path).resolve()
        logger.info("Processing local ingestion for %s", resolved_path)
        if not resolved_path.exists():
            logger.error("Path does not exist: %s", resolved_path)
            return

        if not _is_allowed_local_path(resolved_path):
            logger.error("Local ingestion path is not allowed: %s", resolved_path)
            return
            
        # Use simple directory loader
        loader = DirectoryLoader(str(resolved_path), glob=glob_pattern)
        docs = loader.load()
        
        if not docs:
            logger.warning(f"No documents found in {path} with glob {glob_pattern}")
            return
            
        kb.ingest_documents(docs)
        logger.info(f"Local ingestion successful for {path}")
    except Exception as e:
        logger.error(f"Local ingestion failed for {path}: {e}")


@app.post("/query", response_model=QueryResponse, dependencies=[Depends(require_internal_service)])
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
