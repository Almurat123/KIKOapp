import httpx
from bs4 import BeautifulSoup
from langchain_core.documents import Document
from typing import List, Optional, Set
import asyncio
import logging
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)

class Web3DocCrawler:
    def __init__(self):
        self.headers = {
            "User-Agent": "KiKo-Bot/1.0 (Web3 Documentation Crawler)"
        }

    async def crawl_recursive(self, url: str, max_depth: int = 3, exclude_dirs: Optional[List[str]] = None) -> List[Document]:
        """
        Recursively crawl a documentation site and return LangChain documents.
        This is a placeholder implementation that can be expanded.
        """
        visited = set()
        documents = []
        
        await self._crawl_node(url, 0, max_depth, exclude_dirs or [], visited, documents)
        
        return documents

    async def _crawl_node(self, url: str, current_depth: int, max_depth: int, 
                          exclude_dirs: List[str], visited: Set[str], documents: List[Document]):
        if current_depth > max_depth or url in visited:
            return

        # Simple exclusion check
        if any(ex in url for ex in exclude_dirs):
            return

        visited.add(url)
        logger.info(f"Crawling: {url} (depth {current_depth})")

        try:
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=10.0) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    return

                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()

                # Extract text content
                text = soup.get_text(separator=' ', strip=True)
                
                # Create document
                documents.append(Document(
                    page_content=text,
                    metadata={
                        "source": url,
                        "title": soup.title.string if soup.title else url,
                        "depth": current_depth
                    }
                ))

                # Find sub-links if not at max depth
                if current_depth < max_depth:
                    base_url = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
                    links = []
                    for a in soup.find_all('a', href=True):
                        href = a['href']
                        full_url = urljoin(url, href)
                        
                        # Only follow links on the same domain
                        if full_url.startswith(base_url) and full_url not in visited:
                            links.append(full_url)

                    # Crawl sub-links
                    tasks = [
                        self._crawl_node(link, current_depth + 1, max_depth, exclude_dirs, visited, documents)
                        for link in links[:10]  # Limit breadth for placeholder
                    ]
                    await asyncio.gather(*tasks)

        except Exception as e:
            logger.error(f"Error crawling {url}: {e}")
