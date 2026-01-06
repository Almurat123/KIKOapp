"""
Website Analyzer Tool using Playwright
Deeply analyzes crypto project websites to extract structured information.
Includes comprehensive security safeguards.
"""
import asyncio
import re
import time
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout


# Security Configuration
ALLOWED_DOMAINS = [
    # Crypto-related domains
    'degen.tips', 'uniswap.org', 'aave.com', 'compound.finance',
    'zora.co', 'paragraph.xyz', 'four.meme', 'pump.fun',
    # Common hosting/documentation platforms
    'github.io', 'gitbook.io', 'docs.', 'notion.site',
    # Allow most common TLDs
    '.com', '.org', '.io', '.xyz', '.app', '.finance', '.money',
    '.net', '.co', '.info', '.biz', '.dev', '.tech', '.online',
    '.site', '.website', '.space', '.store', '.club', '.fun',
    '.world', '.life', '.today', '.live', '.network', '.digital',
    # Crypto-specific TLDs
    '.crypto', '.eth', '.nft', '.dao', '.defi', '.web3',
    # Regional TLDs
    '.us', '.uk', '.eu', '.de', '.fr', '.jp', '.cn', '.au',
    '.ca', '.br', '.in', '.ru', '.kr', '.sg', '.hk', '.tw',
    # New generic TLDs
    '.ai', '.ml', '.gg', '.cc', '.tv', '.me', '.to', '.sh',
    '.ly', '.gl', '.vc', '.fm', '.am', '.is', '.it', '.es',
    # Documentation/hosting platforms
    '.vercel.app', '.netlify.app', '.herokuapp.com', '.github.io',
    '.gitlab.io', '.pages.dev', '.web.app', '.firebaseapp.com'
]

BLOCKED_DOMAINS = [
    'localhost', '127.0.0.1', '0.0.0.0',
    'internal', 'local', 'admin'
]

# Rate limiting (simple in-memory)
_last_analysis_time = 0
MIN_ANALYSIS_INTERVAL = 2.0  # seconds between analyses

# Resource limits
MAX_PAGES_TO_VISIT = 4
MAX_PAGE_LOAD_TIME = 15000  # ms
MAX_TOTAL_ANALYSIS_TIME = 60  # seconds




def _validate_url(url: str) -> tuple[bool, str]:
    """
    Validate URL for security.
    Returns (is_valid, error_message)
    """
    try:
        parsed = urlparse(url)
        
        # Check scheme
        if parsed.scheme not in ['http', 'https']:
            return False, f"Invalid URL scheme: {parsed.scheme}"
        
        # Check for blocked domains
        hostname = parsed.hostname or ''
        for blocked in BLOCKED_DOMAINS:
            if blocked in hostname.lower():
                return False, f"Blocked domain: {hostname}"
        
        # Check if domain is in allowed list
        domain_allowed = False
        for allowed in ALLOWED_DOMAINS:
            if allowed.startswith('.'):
                # TLD match
                if hostname.endswith(allowed):
                    domain_allowed = True
                    break
            else:
                # Exact or subdomain match
                if hostname == allowed or hostname.endswith('.' + allowed):
                    domain_allowed = True
                    break
        
        if not domain_allowed:
            return False, f"Domain not in whitelist: {hostname}"
        
        return True, ""
        
    except Exception as e:
        return False, f"URL validation error: {str(e)}"


def _check_rate_limit() -> tuple[bool, str]:
    """
    Check if enough time has passed since last analysis.
    Returns (is_allowed, error_message)
    """
    global _last_analysis_time
    
    current_time = time.time()
    time_since_last = current_time - _last_analysis_time
    
    if time_since_last < MIN_ANALYSIS_INTERVAL:
        wait_time = MIN_ANALYSIS_INTERVAL - time_since_last
        return False, f"Rate limit: wait {wait_time:.1f}s"
    
    _last_analysis_time = current_time
    return True, ""


async def analyze_website_deep(url: str, project_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Deeply analyze a crypto project website using Playwright.
    Navigates through multiple pages (Team, About, Docs) to extract comprehensive information.
    
    Includes security safeguards:
    - URL whitelist validation
    - Rate limiting
    - Resource limits
    - Content blocking
    
    Args:
        url: The website URL to analyze
        project_name: Optional project name for context
        
    Returns:
        Dictionary with structured website analysis data
    """
    result = {
        "websiteReachable": False,
        "designQuality": 0.0,
        "contentDepth": 0.0,
        "team": [],
        "github": [],
        "tokenomics": {},
        "documentation": [],
        "socialLinks": {},
        "hasProduct": False,
        "productDescription": "",
        "summary": ""
    }
    
    # Security: Validate URL
    is_valid, error_msg = _validate_url(url)
    if not is_valid:
        result["summary"] = f"Security: {error_msg}"
        print(f"[Website Analyzer] Security block: {error_msg}")
        return result
    
    # Security: Check rate limit
    is_allowed, error_msg = _check_rate_limit()
    if not is_allowed:
        result["summary"] = f"Security: {error_msg}"
        print(f"[Website Analyzer] {error_msg}")
        return result
    
    # Track total analysis time
    start_time = time.time()
    
    try:
        async with async_playwright() as p:
            # Security: Launch with resource limits
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--disable-dev-shm-usage',  # Reduce memory usage
                    '--disable-gpu',  # Disable GPU
                    '--no-sandbox',  # Required for some environments
                    '--disable-setuid-sandbox',
                    '--disable-web-security',  # For CORS (be careful)
                ]
            )
            
            # Security: Create context with restrictions
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                java_script_enabled=True,  # Need JS for dynamic content
                bypass_csp=False,  # Respect Content Security Policy
                ignore_https_errors=False,  # Don't ignore SSL errors
            )
            
            # Security: Block unnecessary resources (ads, trackers, analytics)
            async def block_resources(route):
                """Block ads, trackers, and heavy resources"""
                url = route.request.url
                resource_type = route.request.resource_type
                
                # Block known ad/tracker domains
                blocked_patterns = [
                    'doubleclick.net', 'googlesyndication.com', 'googletagmanager.com',
                    'google-analytics.com', 'facebook.com/tr', 'facebook.net',
                    'hotjar.com', 'mixpanel.com', 'segment.com', 'amplitude.com'
                ]
                
                if any(pattern in url for pattern in blocked_patterns):
                    await route.abort()
                    return
                
                # Block heavy media that we don't need
                if resource_type in ['media', 'font', 'image']:
                    await route.abort()
                    return
                
                await route.continue_()
            
            await context.route('**/*', block_resources)
            
            page = await context.new_page()
            
            # Security: Set page timeout
            page.set_default_timeout(MAX_PAGE_LOAD_TIME)
            
            # Navigate to the homepage
            try:
                await page.goto(url, wait_until='networkidle', timeout=30000)
                result["websiteReachable"] = True
            except PlaywrightTimeout:
                await page.goto(url, wait_until='domcontentloaded', timeout=15000)
                result["websiteReachable"] = True
            except Exception as e:
                result["summary"] = f"Failed to load website: {str(e)}"
                await browser.close()
                return result
            
            await page.wait_for_timeout(2000)
            
            # Extract homepage data
            page_text = await page.inner_text('body')
            all_links = await page.eval_on_selector_all('a[href]', 
                'elements => elements.map(e => ({href: e.href, text: e.innerText}))')
            
            # Extract basic info from homepage
            result["github"] = _extract_code_repos([link['href'] for link in all_links])
            result["documentation"] = _extract_docs_links([link['href'] for link in all_links], url)
            result["socialLinks"] = _extract_social_links([link['href'] for link in all_links])
            result["tokenomics"] = _extract_tokenomics(page_text)
            result["hasProduct"], result["productDescription"] = _check_for_product(page_text)
            
            # Find and visit important pages
            pages_to_visit = _identify_important_pages(all_links, url)
            
            # Security: Limit number of pages to visit
            pages_to_visit = dict(list(pages_to_visit.items())[:MAX_PAGES_TO_VISIT])
            
            print(f"[Website Analyzer] Found {len(pages_to_visit)} pages to visit: {list(pages_to_visit.keys())}")
            
            # Visit each important page and extract data
            for page_type, page_url in pages_to_visit.items():
                # Security: Check total analysis time
                elapsed_time = time.time() - start_time
                if elapsed_time > MAX_TOTAL_ANALYSIS_TIME:
                    print(f"[Website Analyzer] Timeout: Analysis exceeded {MAX_TOTAL_ANALYSIS_TIME}s")
                    break
                
                try:
                    print(f"[Website Analyzer] Visiting {page_type} page: {page_url}")
                    await page.goto(page_url, wait_until='domcontentloaded', timeout=MAX_PAGE_LOAD_TIME)
                    await page.wait_for_timeout(1500)
                    
                    sub_page_text = await page.inner_text('body')
                    sub_page_links = await page.eval_on_selector_all('a[href]', 
                        'elements => elements.map(e => e.href)')
                    
                    # Extract data based on page type
                    if page_type in ['team', 'about']:
                        team_data = await _extract_team_info(page, sub_page_text)
                        if team_data:
                            result["team"].extend(team_data)
                    
                    # Look for GitHub links on any page
                    github_links = _extract_code_repos(sub_page_links)
                    for link in github_links:
                        if link not in result["github"]:
                            result["github"].append(link)
                    
                    # Look for docs on any page
                    doc_links = _extract_docs_links(sub_page_links, url)
                    for link in doc_links:
                        if link not in result["documentation"]:
                            result["documentation"].append(link)
                    
                    # Extract tokenomics if not found yet
                    if not result["tokenomics"] and page_type == 'tokenomics':
                        result["tokenomics"] = _extract_tokenomics(sub_page_text)
                    
                except Exception as e:
                    print(f"[Website Analyzer] Error visiting {page_type}: {str(e)}")
                    continue
            
            # Go back to homepage for design assessment
            await page.goto(url, wait_until='domcontentloaded', timeout=15000)
            await page.wait_for_timeout(1000)
            
            # Assess design quality and content depth
            result["designQuality"] = await _assess_design_quality(page)
            result["contentDepth"] = _assess_content_depth(page_text, [link['href'] for link in all_links])
            
            # Remove duplicate team members
            if result["team"]:
                seen = set()
                unique_team = []
                for member in result["team"]:
                    member_key = member.get("name", "").lower()
                    if member_key and member_key not in seen:
                        seen.add(member_key)
                        unique_team.append(member)
                result["team"] = unique_team[:10]
            
            # Generate summary
            result["summary"] = _generate_summary(result, project_name or "Project")
            
            await browser.close()
            
    except Exception as e:
        result["summary"] = f"Analysis error: {str(e)}"
    
    return result


def _identify_important_pages(links: List[Dict[str, str]], base_url: str) -> Dict[str, str]:
    """
    Identify important pages to visit (Team, About, Docs, Tokenomics).
    Returns a dict mapping page type to URL.
    """
    pages = {}
    
    # Keywords for different page types
    keywords = {
        'team': ['team', 'about', 'about-us', 'founders', 'leadership'],
        'docs': ['docs', 'documentation', 'whitepaper', 'litepaper'],
        'tokenomics': ['tokenomics', 'token', 'economics'],
        'github': ['github', 'code', 'repository']
    }
    
    for link in links:
        href = link.get('href', '').lower()
        text = link.get('text', '').lower()
        
        # Only consider internal links or same-domain links
        if not href.startswith(base_url) and not href.startswith('/'):
            continue
        
        # Check each page type
        for page_type, page_keywords in keywords.items():
            if page_type not in pages:  # Only take first match
                for keyword in page_keywords:
                    if keyword in href or keyword in text:
                        # Make absolute URL
                        if href.startswith('/'):
                            from urllib.parse import urljoin
                            pages[page_type] = urljoin(base_url, href)
                        else:
                            pages[page_type] = href
                        break
    
    return pages


def _extract_code_repos(links: List[str]) -> List[str]:
    """Extract GitHub/GitLab repository links."""
    repos = []
    patterns = [
        r'https?://github\.com/[\w-]+/[\w-]+',
        r'https?://gitlab\.com/[\w-]+/[\w-]+',
    ]
    
    for link in links:
        for pattern in patterns:
            if re.match(pattern, link):
                # Avoid duplicates
                if link not in repos:
                    repos.append(link)
    
    return repos[:5]  # Limit to 5 repos


def _extract_docs_links(links: List[str], base_url: str) -> List[str]:
    """Extract documentation/whitepaper links."""
    docs = []
    doc_keywords = ['docs', 'documentation', 'whitepaper', 'litepaper', 'guide', 'wiki']
    
    for link in links:
        link_lower = link.lower()
        if any(keyword in link_lower for keyword in doc_keywords):
            if link not in docs:
                docs.append(link)
    
    return docs[:5]


def _extract_social_links(links: List[str]) -> Dict[str, str]:
    """Extract social media profile links."""
    socials = {}
    
    patterns = {
        'twitter': r'https?://(twitter\.com|x\.com)/([\w]+)',
        'discord': r'https?://discord\.(gg|com)/([\w]+)',
        'telegram': r'https?://t\.me/([\w]+)',
        'medium': r'https?://medium\.com/@?([\w-]+)',
        'reddit': r'https?://reddit\.com/r/([\w]+)',
    }
    
    for link in links:
        for platform, pattern in patterns.items():
            match = re.search(pattern, link)
            if match and platform not in socials:
                socials[platform] = link
    
    return socials


async def _extract_team_info(page: Page, page_text: str) -> List[Dict[str, str]]:
    """Extract team member information."""
    team = []
    
    # Look for team section
    team_keywords = ['team', 'about us', 'founders', 'core team', 'leadership']
    
    # Try to find team section
    for keyword in team_keywords:
        try:
            # Look for headings containing team keywords
            team_section = await page.query_selector(f'h1:has-text("{keyword}"), h2:has-text("{keyword}"), h3:has-text("{keyword}")')
            if team_section:
                # Get the parent section
                parent = await team_section.evaluate('el => el.closest("section, div")')
                if parent:
                    # Extract names and roles (simple heuristic)
                    section_text = await page.evaluate('el => el.innerText', parent)
                    # This is a simplified extraction - in production, you'd use more sophisticated parsing
                    lines = section_text.split('\n')
                    for i, line in enumerate(lines):
                        if len(line.strip()) > 2 and len(line.strip()) < 50:
                            # Potential name or role
                            team.append({
                                "name": line.strip(),
                                "role": lines[i+1].strip() if i+1 < len(lines) else "Unknown"
                            })
                    break
        except:
            continue
    
    return team[:10]  # Limit to 10 team members


def _extract_tokenomics(page_text: str) -> Dict[str, Any]:
    """Extract tokenomics information."""
    tokenomics = {}
    
    # Look for supply information
    supply_patterns = [
        r'total supply[:\s]+([0-9,]+)',
        r'max supply[:\s]+([0-9,]+)',
        r'circulating supply[:\s]+([0-9,]+)',
    ]
    
    for pattern in supply_patterns:
        match = re.search(pattern, page_text, re.IGNORECASE)
        if match:
            key = pattern.split('[')[0].replace('\\', '').strip()
            tokenomics[key] = match.group(1)
    
    # Look for distribution/allocation
    if 'distribution' in page_text.lower() or 'allocation' in page_text.lower():
        tokenomics['hasDistributionInfo'] = True
    
    return tokenomics


async def _assess_design_quality(page: Page) -> float:
    """Assess website design quality (0-1 scale)."""
    score = 0.5  # Base score
    
    try:
        # Check for modern CSS frameworks
        has_modern_css = await page.evaluate('''() => {
            const styles = Array.from(document.styleSheets);
            return styles.some(sheet => {
                try {
                    return sheet.href && (
                        sheet.href.includes('bootstrap') ||
                        sheet.href.includes('tailwind') ||
                        sheet.href.includes('material')
                    );
                } catch { return false; }
            });
        }''')
        
        if has_modern_css:
            score += 0.2
        
        # Check for animations/transitions
        has_animations = await page.evaluate('''() => {
            const elements = document.querySelectorAll('*');
            return Array.from(elements).some(el => {
                const style = window.getComputedStyle(el);
                return style.transition !== 'all 0s ease 0s' || style.animation !== 'none 0s ease 0s';
            });
        }''')
        
        if has_animations:
            score += 0.15
        
        # Check for responsive design
        has_viewport = await page.evaluate('''() => {
            const meta = document.querySelector('meta[name="viewport"]');
            return meta !== null;
        }''')
        
        if has_viewport:
            score += 0.15
        
    except:
        pass
    
    return min(score, 1.0)


def _assess_content_depth(page_text: str, links: List[str]) -> float:
    """Assess content depth (0-1 scale)."""
    score = 0.0
    
    # Word count
    word_count = len(page_text.split())
    if word_count > 500:
        score += 0.3
    if word_count > 1000:
        score += 0.2
    
    # Number of internal links
    if len(links) > 10:
        score += 0.2
    if len(links) > 20:
        score += 0.15
    
    # Check for key sections
    key_sections = ['about', 'roadmap', 'tokenomics', 'team', 'faq']
    sections_found = sum(1 for section in key_sections if section in page_text.lower())
    score += (sections_found / len(key_sections)) * 0.15
    
    return min(score, 1.0)


def _check_for_product(page_text: str) -> tuple[bool, str]:
    """Check if the website describes an actual product."""
    product_keywords = ['app', 'platform', 'dapp', 'protocol', 'exchange', 'marketplace', 'wallet']
    
    for keyword in product_keywords:
        if keyword in page_text.lower():
            # Extract a brief description
            sentences = page_text.split('.')
            for sentence in sentences:
                if keyword in sentence.lower():
                    return True, sentence.strip()[:200]
    
    return False, ""


def _generate_summary(result: Dict[str, Any], project_name: str) -> str:
    """Generate a summary of the analysis."""
    parts = []
    
    if result["websiteReachable"]:
        parts.append(f"{project_name} website is reachable")
        
        if result["designQuality"] > 0.7:
            parts.append("with professional design")
        elif result["designQuality"] > 0.5:
            parts.append("with decent design")
        
        if result["team"]:
            parts.append(f"featuring {len(result['team'])} team members")
        
        if result["github"]:
            parts.append(f"with {len(result['github'])} code repositories")
        
        if result["tokenomics"]:
            parts.append("including tokenomics information")
        
        if result["hasProduct"]:
            parts.append("describing an actual product/platform")
        
        if not result["team"] and not result["github"]:
            parts.append("but lacking team and code transparency")
    else:
        return "Website unreachable or failed to load"
    
    return ", ".join(parts) + "."
