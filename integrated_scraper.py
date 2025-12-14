import os
import sys
import time
import random
import json
import argparse
import pandas as pd
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page, TimeoutError as PlaywrightTimeoutError
from fake_useragent import UserAgent
from typing import List, Dict, Set, Tuple, Optional, Any, Callable
from database import db  # Database abstraction layer
from config import config  # 設定ファイルをインポート

# --- 設定読み込み ---
BASE_URL: str = config.BASE_URL
CATEGORIES: Dict[str, str] = config.CATEGORIES
OUTPUT_DIR: str = config.OUTPUT_DIR
LINKS_FILE: str = config.LINKS_FILE
CHECKPOINT_FILE: str = config.CHECKPOINT_FILE
MAX_WORKERS: int = config.MAX_WORKERS
ITEMS_PER_PAGE: int = config.ITEMS_PER_PAGE
MAX_PAGES_PER_CATEGORY: int = config.MAX_PAGES_PER_CATEGORY
MAX_RETRIES: int = config.MAX_RETRIES
BASE_RETRY_DELAY: int = config.BASE_RETRY_DELAY
MAX_REQUESTS_PER_SECOND: int = config.MAX_REQUESTS_PER_SECOND
BURST_SIZE: int = config.BURST_SIZE
BURST_WINDOW: int = config.BURST_WINDOW
MAX_BROWSER_USES: int = config.MAX_BROWSER_USES

# --- Japanese Name Mappings ---
CATEGORY_NAMES: Dict[str, str] = config.CATEGORY_NAMES
GENRE_NAMES: Dict[str, str] = config.GENRE_NAMES

# --- Setup ---
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def get_random_user_agent() -> str:
    """ランダムなUser-Agentを取得"""
    try:
        ua = UserAgent()
        return ua.random
    except:
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

def get_random_referer() -> str:
    """Get random referer URL to avoid blocking"""
    referers: List[str] = [
        "https://www.google.com/",
        "https://www.google.co.jp/",
        "https://www.yahoo.co.jp/",
        "https://search.yahoo.co.jp/",
        "https://www.bing.com/",
        "https://www.facebook.com/",
        "https://twitter.com/",
        "https://www.linkedin.com/",
        "https://www.reddit.com/",
        "https://www.instagram.com/",
    ]
    return random.choice(referers)

def get_random_timezone() -> str:
    """Get random timezone for spoofing"""
    timezones: List[str] = [
        "Asia/Tokyo",
        "Asia/Seoul",
        "Asia/Shanghai",
        "Asia/Hong_Kong",
        "Asia/Singapore",
    ]
    return random.choice(timezones)

def retry_with_backoff(func: Callable, max_retries: int = MAX_RETRIES, base_delay: int = BASE_RETRY_DELAY) -> Any:
    """Retry function with exponential backoff"""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay:.2f}s...")
            time.sleep(delay)
    return None

# Thread-local storage for Playwright instances
import threading
from collections import deque

_thread_local = threading.local()

# Global rate limiting
_request_times = deque(maxlen=100)  # Track recent request times
_request_lock = threading.Lock()
_consecutive_errors = 0
_error_lock = threading.Lock()

def rate_limit_wait():
    """Smart rate limiting with burst control"""
    with _request_lock:
        now = time.time()
        
        # Remove old entries (older than 1 second)
        while _request_times and now - _request_times[0] > 1.0:
            _request_times.popleft()
        
        # Check if we're over the rate limit
        if len(_request_times) >= MAX_REQUESTS_PER_SECOND:
            sleep_time = 1.0 - (now - _request_times[0])
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        # Burst control: check recent burst window
        recent_requests = sum(1 for t in _request_times if now - t < BURST_WINDOW)
        if recent_requests >= BURST_SIZE:
            time.sleep(random.uniform(0.5, 1.0))
        
        _request_times.append(time.time())

def check_for_blocking(page_content, url=""):
    """Detect if we're being blocked"""
    global _consecutive_errors
    
    blocking_indicators = [
        "access denied",
        "blocked",
        "captcha",
        "too many requests",
        "rate limit",
        "403 forbidden",
        "429"
    ]
    
    content_lower = page_content.lower() if page_content else ""
    is_blocked = any(indicator in content_lower for indicator in blocking_indicators)
    
    with _error_lock:
        if is_blocked:
            _consecutive_errors += 1
            if _consecutive_errors >= 3:
                print(f"⚠️  Blocking detected! Slowing down... (errors: {_consecutive_errors})")
                time.sleep(random.uniform(5, 10))
            return True
        else:
            _consecutive_errors = max(0, _consecutive_errors - 1)
    
    return False

def get_thread_browser() -> Browser:
    """Get or create a browser instance for the current thread"""
    if not hasattr(_thread_local, 'playwright'):
        _thread_local.playwright = sync_playwright().start()
        _thread_local.browser = _thread_local.playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
            ]
        )
        _thread_local.uses = 0
    
    _thread_local.uses += 1
    if _thread_local.uses > MAX_BROWSER_USES:
        # print(f"Restarting browser for thread {threading.get_ident()} to free memory...")
        try:
            _thread_local.browser.close()
        except:
            pass
        _thread_local.browser = _thread_local.playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
            ]
        )
        _thread_local.uses = 0
        
    return _thread_local.browser

def cleanup_thread_browser():
    """Cleanup browser for current thread"""
    if hasattr(_thread_local, 'browser'):
        _thread_local.browser.close()
        _thread_local.playwright.stop()
        delattr(_thread_local, 'browser')
        delattr(_thread_local, 'playwright')

def create_browser_context(browser: Browser, headless=True):
    """Create a new browser context with anti-blocking measures"""
    
    # Random delay to avoid detection
    time.sleep(random.uniform(0.1, 0.5))
    
    # Get random configurations
    user_agent = get_random_user_agent()
    referer = get_random_referer()
    timezone = get_random_timezone()
    
    # Random viewport size (more realistic)
    viewports = [
        {'width': 1920, 'height': 1080},
        {'width': 1366, 'height': 768},
        {'width': 1536, 'height': 864},
        {'width': 1440, 'height': 900},
    ]
    viewport = random.choice(viewports)
    
    # Create context with anti-detection settings
    context = browser.new_context(
        user_agent=user_agent,
        viewport=viewport,
        locale='ja-JP',
        timezone_id=timezone,
        geolocation={
            'latitude': 26.2124 + random.uniform(-0.1, 0.1),
            'longitude': 127.6809 + random.uniform(-0.1, 0.1),
            'accuracy': 100
        },
        permissions=['geolocation'],
        extra_http_headers={
            'Referer': referer,
            'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        }
    )
    
    # CRITICAL: Enhanced stealth measures
    context.add_init_script('''
        // Remove webdriver property (MOST IMPORTANT)
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
        
        // Fake plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format'},
                {name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: ''},
                {name: 'Native Client', filename: 'internal-nacl-plugin', description: ''},
            ]
        });
        
        // Fake languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['ja-JP', 'ja', 'en-US', 'en']
        });
        
        // Remove automation indicators
        delete navigator.__proto__.webdriver;
        
        // Canvas fingerprinting protection
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
            const context = this.getContext('2d');
            if (context) {
                const imageData = context.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] += Math.floor(Math.random() * 3) - 1;
                    imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1;
                    imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1;
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
        };
        
        // WebGL fingerprinting protection
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, arguments);
        };
        
        // AudioContext fingerprinting protection
        const audioContext = window.AudioContext || window.webkitAudioContext;
        if (audioContext) {
            const OriginalAudioContext = audioContext;
            window.AudioContext = function() {
                const context = new OriginalAudioContext();
                const originalCreateOscillator = context.createOscillator;
                context.createOscillator = function() {
                    const oscillator = originalCreateOscillator.apply(this, arguments);
                    const originalStart = oscillator.start;
                    oscillator.start = function() {
                        oscillator.frequency.value += Math.random() * 0.0001;
                        return originalStart.apply(this, arguments);
                    };
                    return oscillator;
                };
                return context;
            };
        }
        
        // Screen resolution consistency
        Object.defineProperty(screen, 'availWidth', {get: () => window.innerWidth});
        Object.defineProperty(screen, 'availHeight', {get: () => window.innerHeight});
        Object.defineProperty(screen, 'width', {get: () => window.innerWidth});
        Object.defineProperty(screen, 'height', {get: () => window.innerHeight});
        
        // Chrome runtime
        window.chrome = {
            runtime: {}
        };
    ''')
    
    return context

def get_japanese_filename(category_name):
    """Generate Japanese filename with counter for the day"""
    category_ja = CATEGORY_NAMES.get(category_name, "不明")
    genre_ja = GENRE_NAMES.get(category_name, "不明")
    today = datetime.now().strftime("%Y%m%d")
    
    # Check existing files to determine counter
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    
    existing_files = [f for f in os.listdir(OUTPUT_DIR) 
                     if f.startswith(f"{category_ja}_{genre_ja}_{today}_") and f.endswith('.csv')]
    
    counter = len(existing_files) + 1
    filename = f"{category_ja}_{genre_ja}_{today}_{counter:02d}.csv"
    
    return filename

def should_refresh_links(links_file, force_refresh=False, skip_refresh=False):
    """Check if links should be refreshed based on age or flags"""
    if force_refresh:
        print("Force refresh requested. Will collect fresh links.")
        return True
    
    if skip_refresh:
        print("Skip refresh requested. Will use existing links if available.")
        return False
    
    if not os.path.exists(links_file):
        print("Links file not found. Will collect fresh links.")
        return True
    
    try:
        with open(links_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Check if metadata exists
        if "metadata" not in data:
            print("Links file missing metadata. Will collect fresh links.")
            return True
        
        last_updated_str = data["metadata"].get("last_updated")
        if not last_updated_str:
            print("Last update time not found. Will collect fresh links.")
            return True
        
        # Parse the last updated time
        last_updated = datetime.fromisoformat(last_updated_str)
        age = datetime.now() - last_updated
        
        if age > timedelta(hours=24):
            print(f"Links are {age.days} days old. Will collect fresh links.")
            return True
        else:
            print(f"Links are up to date (updated {age.seconds // 3600} hours ago). Using existing links.")
            return False
            
    except Exception as e:
        print(f"Error checking links age: {e}. Will collect fresh links.")
        return True

def load_links_with_metadata(links_file):
    """Load links from file with metadata support"""
    if not os.path.exists(links_file):
        return {}
    
    try:
        with open(links_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Handle both old format (direct dict) and new format (with metadata)
        if "metadata" in data and "data" in data:
            return data["data"]
        else:
            # Old format - return as is
            return data
    except Exception as e:
        print(f"Error loading links: {e}")
        return {}

def save_links_with_metadata(links_file, all_links):
    """Save links to file with metadata"""
    total_links = sum(len(links) for links in all_links.values())
    
    data = {
        "metadata": {
            "last_updated": datetime.now().isoformat(),
            "total_links": total_links
        },
        "data": all_links
    }
    
    with open(links_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    
    print(f"Saved {total_links} links with metadata to {links_file}")

def save_checkpoint(checkpoint_file, category, processed_urls):
    """Save checkpoint for resuming scraping"""
    try:
        # Load existing checkpoint
        checkpoint = {}
        if os.path.exists(checkpoint_file):
            with open(checkpoint_file, "r", encoding="utf-8") as f:
                checkpoint = json.load(f)
        
        # Update checkpoint for this category
        checkpoint[category] = {
            "processed_urls": list(processed_urls),
            "count": len(processed_urls),
            "last_updated": datetime.now().isoformat()
        }
        
        # Save checkpoint
        with open(checkpoint_file, "w", encoding="utf-8") as f:
            json.dump(checkpoint, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving checkpoint: {e}")

def load_checkpoint(checkpoint_file, category):
    """Load checkpoint to resume scraping"""
    try:
        if not os.path.exists(checkpoint_file):
            return set()
        
        with open(checkpoint_file, "r", encoding="utf-8") as f:
            checkpoint = json.load(f)
        
        if category in checkpoint:
            data = checkpoint[category]
            # Check if checkpoint is from today
            last_updated = data.get("last_updated", "")
            if not last_updated.startswith(datetime.now().strftime("%Y-%m-%d")):
                print(f"[{category}] Checkpoint is stale (from {last_updated}), starting fresh.")
                return set()
                
            processed_urls = set(data.get("processed_urls", []))
            print(f"[{category}] Resuming from checkpoint: {len(processed_urls)} URLs already processed")
            return processed_urls
        return set()
    except Exception as e:
        print(f"Error loading checkpoint: {e}")
        return set()


# --- Phase 1: Collect Links ---
def collect_links(category_name, base_url, browser: Browser):
    print(f"[{category_name}] Starting link collection...")
    context = create_browser_context(browser)
    page = context.new_page()
    links = []
    page_num = 1
    consecutive_empty_pages = 0
    start_time = time.time()
    MAX_COLLECTION_TIME = 600
    max_pages = None  # Will be detected from pagination
    
    try:
        while True:
            elapsed_time = time.time() - start_time
            if elapsed_time > MAX_COLLECTION_TIME:
                print(f"[{category_name}] ⚠️  Collection timeout ({MAX_COLLECTION_TIME}s). Stopping.")
                break
            
            rate_limit_wait()
            
            # Check against detected max pages
            if max_pages and page_num > max_pages:
                print(f"[{category_name}] Reached detected maximum page ({max_pages}). Stopping.")
                break
            
            # Safety check for infinite loops (only if max_pages not detected)
            if not max_pages and page_num > MAX_PAGES_PER_CATEGORY:
                print(f"[{category_name}] ⚠️  Max pages not detected, using safety limit ({MAX_PAGES_PER_CATEGORY}). Stopping.")
                break
            
            if consecutive_empty_pages >= 3:
                print(f"[{category_name}] Found {consecutive_empty_pages} consecutive empty pages. Stopping.")
                break
            
            url = f"{base_url}?perPage={ITEMS_PER_PAGE}&page={page_num}"
            print(f"[{category_name}] Visiting: {url}")
            
            try:
                page.goto(url, wait_until='domcontentloaded', timeout=15000)
            except Exception as e:
                print(f"[{category_name}] Failed to load page {page_num}: {e}")
                consecutive_empty_pages += 1
                if consecutive_empty_pages >= 3:
                    break
                page_num += 1
                continue
            
            # Detect maximum pages from pagination (first page only)
            if page_num == 1 and not max_pages:
                try:
                    import re
                    
                    # Method 1: Try XPath selector (most reliable)
                    xpath_selectors = [
                        '//*[@id="search-page"]/div[2]/div[2]/div[2]/div/span[1]',
                        '//span[contains(@class, "result-count")]',
                        '//div[contains(text(), "件")]',
                    ]
                    
                    for xpath in xpath_selectors:
                        try:
                            element = page.locator(f'xpath={xpath}').first
                            text = element.inner_text(timeout=5000)
                            match = re.search(r'(\d+)', text)
                            if match:
                                total_items = int(match.group(1))
                                if total_items > 10:  # Sanity check
                                    max_pages = (total_items + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE
                                    print(f"[{category_name}] ✓ Detected {total_items} items from XPath, max pages: {max_pages}")
                                    break
                        except:
                            continue
                    
                    # Method 2: Try body text patterns
                    if not max_pages:
                        body_text = page.inner_text("body")
                        
                        patterns = [
                            r'(\d+)\s*件が該当',
                            r'(\d+)\s*件',
                            r'(\d+)件',
                        ]
                        
                        for pattern in patterns:
                            match = re.search(pattern, body_text)
                            if match:
                                total_items = int(match.group(1))
                                if total_items > 10:
                                    max_pages = (total_items + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE
                                    print(f"[{category_name}] ✓ Detected {total_items} items from text, max pages: {max_pages}")
                                    break
                    
                    # Method 3: Fallback to pagination links
                    if not max_pages:
                        # Fallback: try to find pagination links
                        # Try multiple selectors
                        pagination_selectors = [
                            "ul.pagination li a",
                            ".pagination a",
                            "li.pagination-next",
                            "a[href*='page=']"
                        ]
                        
                        page_numbers = []
                        for selector in pagination_selectors:
                            try:
                                links = page.query_selector_all(selector)
                                for link in links:
                                    text = link.inner_text().strip()
                                    if text.isdigit():
                                        page_numbers.append(int(text))
                                    # Also check href for page numbers
                                    href = link.get_attribute("href")
                                    if href:
                                        page_match = re.search(r'page=(\d+)', href)
                                        if page_match:
                                            page_numbers.append(int(page_match.group(1)))
                                
                                if page_numbers:
                                    break
                            except:
                                continue
                        
                        if page_numbers:
                            max_pages = max(page_numbers)
                            print(f"[{category_name}] ✓ Detected maximum pages from links: {max_pages}")
                        else:
                            print(f"[{category_name}] ⚠️  Could not detect max pages, will use safety limit")
                    
                except Exception as e:
                    print(f"[{category_name}] Error detecting max pages: {e}")
            
            
            try:
                selectors = ["a.button.detail-button", "a.detail-button"]
                page_links = []
                
                for selector in selectors:
                    try:
                        page.wait_for_selector(selector, timeout=10000)
                        elements = page.query_selector_all(selector)
                        for elem in elements:
                            link = elem.get_attribute("href")
                            if link:
                                page_links.append(link)
                        
                        if page_links:
                            break
                    except PlaywrightTimeoutError:
                        continue
                
                if not page_links:
                    print(f"[{category_name}] No links found on page {page_num}. URL: {page.url}")
                    consecutive_empty_pages += 1
                    
                    next_buttons = page.query_selector_all("li.pagination-next a")
                    if not next_buttons:
                        print(f"[{category_name}] No next page button found. Finished collection.")
                        break
                    
                    if consecutive_empty_pages >= 2:
                        print(f"[{category_name}] Multiple empty pages despite next button. Stopping.")
                        break
                    
                    page_num += 1
                    time.sleep(random.uniform(0.5, 1.5))
                    continue
                
                consecutive_empty_pages = 0
                links.extend(page_links)
                print(f"[{category_name}] Page {page_num}: Collected {len(page_links)} links. Total: {len(links)}")
                
                # Check for "Next" button
                next_buttons = page.query_selector_all("li.pagination-next a")
                if not next_buttons:
                    print(f"[{category_name}] No next page. Finished collection.")
                    break
                
                page_num += 1
                time.sleep(random.uniform(0.5, 1.5))
                
            except PlaywrightTimeoutError:
                print(f"[{category_name}] Timeout on page {page_num}. Stopping.")
                break
                
    except Exception as e:
        print(f"[{category_name}] Error: {e}")
    finally:
        try:
            context.close()
        except:
            pass
        
    print(f"[{category_name}] ✓ Collection complete: {len(links)} unique links in {elapsed_time:.1f}s")
    return list(set(links))

# --- Phase 2: Scrape Details ---
def scrape_detail(url, category):
    # Rate limiting to prevent blocking
    rate_limit_wait()
    
    # Random delay to avoid detection (reduced for performance)
    time.sleep(random.uniform(0.3, 1.2))
    
    # Get thread-local browser
    browser = get_thread_browser()
    context = create_browser_context(browser)
    page = context.new_page()
    data = {"url": url, "category": category, "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=10000)
        
        # Check for blocking (DISABLED - causing false positives)
        # if check_for_blocking(page.content(), url):
        #     print(f"⚠️  Blocking detected on {url}, skipping...")
        #     data["error"] = "Blocked"
        #     return data
        
        # Basic Info
        try:
            h1 = page.query_selector("h1")
            data["title"] = h1.inner_text().strip() if h1 else ""
        except:
            data["title"] = ""
            
        try:
            price_elem = page.query_selector(".bukken-price")
            data["price"] = price_elem.inner_text().strip() if price_elem else ""
        except:
            data["price"] = ""

        # Favorites
        try:
            fav_elem = page.query_selector("a.btn-fav")
            if fav_elem:
                data["favorites"] = fav_elem.inner_text().replace("お気に入り追加", "").strip()
            else:
                data["favorites"] = "0"
        except:
            data["favorites"] = "0"

        # Dates (Update Date, Expiry Date)
        try:
            body_text = page.inner_text("body")
            import re
            
            update_match = re.search(r"更新日[:：]\s*(\d{4}/\d{1,2}/\d{1,2})", body_text)
            data["update_date"] = update_match.group(1) if update_match else ""
            
            expiry_match = re.search(r"公開期限[:：]\s*(\d{4}/\d{1,2}/\d{1,2})", body_text)
            data["expiry_date"] = expiry_match.group(1) if expiry_match else ""
        except:
            data["update_date"] = ""
            data["expiry_date"] = ""

        # Images - collect only large-sized property images
        try:
            img_elements = page.query_selector_all(".bx-viewport img")
            img_urls = []
            
            for img in img_elements:
                src = img.get_attribute("src")
                if not src:
                    continue
                
                # Exclude GIF images
                if src.lower().endswith('.gif'):
                    continue
                
                # Filter: Only include images that are likely to be large property images
                src_lower = src.lower()
                
                # Include if URL contains 'large' or similar indicators
                if any(indicator in src_lower for indicator in ['large', '_l.', '_big.', 'detail', 'main']):
                    img_urls.append(src)
                # Also check if it's not a thumbnail or small image
                elif not any(exclude in src_lower for exclude in ['thumb', 'small', '_s.', '_m.', 'icon', 'logo']):
                    # If no clear indicator, check image dimensions (if available)
                    try:
                        # Evaluate dimensions in page context
                        width = img.get_attribute("width")
                        height = img.get_attribute("height")
                        
                        if width and height:
                            w, h = int(width), int(height)
                            # Only include images larger than 400x300
                            if w >= 400 and h >= 300:
                                img_urls.append(src)
                        else:
                            # If dimensions not available, include by default
                            img_urls.append(src)
                    except:
                        # If we can't determine size, include it
                        img_urls.append(src)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_img_urls = []
            for img_url in img_urls:
                if img_url not in seen:
                    seen.add(img_url)
                    unique_img_urls.append(img_url)
            
            data["images"] = " | ".join(unique_img_urls)
        except Exception as e:
            print(f"Error collecting images for {url}: {e}")
            data["images"] = ""

        # Table Data (Generic extraction of key-value pairs)
        tables = page.query_selector_all("table")
        for table in tables:
            rows = table.query_selector_all("tr")
            for row in rows:
                try:
                    th = row.query_selector("th")
                    td = row.query_selector("td")
                    if th and td:
                        th_text = th.inner_text().strip()
                        td_text = td.inner_text().strip()
                        # Clean keys to be column friendly
                        key = th_text.replace("\n", "").replace(" ", "")
                        if key and key not in data:
                            data[key] = td_text
                except:
                    continue
                    
        # Company Info
        try:
            company_section = page.query_selector(".company-info")
            if company_section:
                company_name_elem = company_section.query_selector(".company-name")
                if company_name_elem:
                    data["company_name"] = company_name_elem.inner_text().strip()
        except:
            pass

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        data["error"] = str(e)
    finally:
        try:
            context.close()
        except:
            pass
        
    return data

# --- Helper Functions for Database Integration ---

def transform_to_db_format(scraped_data: dict, category: str) -> dict:
    """Transform scraped data to database format"""
    # Separate fixed fields from flexible property_data
    fixed_fields = {
        "url", "category", "scraped_at", "title", "price", 
        "favorites", "update_date", "expiry_date", "images", "company_name"
    }
    
    # Extract images as list
    images_str = scraped_data.get("images", "")
    images_list = [img.strip() for img in images_str.split("|") if img.strip()] if images_str else []
    
    # Build property_data dict with all non-fixed fields
    property_data = {}
    for key, value in scraped_data.items():
        if key not in fixed_fields and key != "category" and key != "error":
            property_data[key] = value
    
    # Build database record
    db_record = {
        "url": scraped_data["url"],
        "category": category,
        "category_type": CATEGORY_NAMES[category],
        "category_name_ja": CATEGORY_NAMES[category],
        "genre_name_ja": GENRE_NAMES[category],
        "title": scraped_data.get("title"),
        "price": scraped_data.get("price"),
        "favorites": int(scraped_data.get("favorites", 0)) if scraped_data.get("favorites") else 0,
        "update_date": scraped_data.get("update_date"),
        "expiry_date": scraped_data.get("expiry_date"),
        "images": images_list,
        "company_name": scraped_data.get("company_name"),
        "property_data": property_data
    }
    
    return db_record

def export_to_csv():
    """Export collected data from DB to CSV"""
    print(f"\n{'='*70}")
    print("Exporting Data to CSV...")
    print(f"{'='*70}")
    
    try:
        # Get all active properties
        active_properties = db.get_all_active_properties()
        
        if not active_properties:
            print("No active properties found to export.")
            return

        # Group by category
        data_by_category = {}
        today = datetime.now().strftime("%Y_%m_%d")
        
        for item in active_properties:
            category = item["category"]
            
            if category not in data_by_category:
                data_by_category[category] = []
            
            # Clean data (remove unusual line terminators)
            def clean_text(text):
                if isinstance(text, str):
                    return text.replace('\u2028', '').replace('\u2029', '').replace('\r', '').replace('\n', ' ')
                return text

            # Flatten data for CSV
            flat_item = {
                "title": clean_text(item["title"]),
                "price": clean_text(item["price"]),
                "url": item["url"],
                "favorites": item["favorites"],
                "update_date": item["update_date"],
                "expiry_date": item["expiry_date"],
                "images": " | ".join(item["images"]) if isinstance(item["images"], list) else str(item["images"]),
                "company_name": clean_text(item["company_name"])
            }
            
            # Add dynamic property data
            property_data = item.get("property_data", {})
            if isinstance(property_data, dict):
                for key, value in property_data.items():
                    flat_item[key] = clean_text(value)
                
            data_by_category[category].append(flat_item)
        
        # Export each category to CSV
        for category, items in data_by_category.items():
            if not items:
                continue
                
            df = pd.DataFrame(items)
            
            # Generate filename: Category_Genre_YYYY_MM_DD.csv
            cat_name_ja = CATEGORY_NAMES.get(category, "不明")
            genre_name_ja = GENRE_NAMES.get(category, "不明")
            filename = f"{cat_name_ja}_{genre_name_ja}_{today}.csv"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            # Save to CSV
            df.to_csv(filepath, index=False, encoding="utf-8-sig")
            print(f"✓ Exported {len(items)} items to {filename}")
            
    except Exception as e:
        print(f"Error exporting to CSV: {e}")

def detect_diff(category: str, current_urls: list) -> tuple:
    """Detect new and sold properties"""
    current_set = set(current_urls)
    previous_urls = db.get_previous_links(category, days_back=1)
    previous_set = set(previous_urls)
    
    new_urls = list(current_set - previous_set)
    sold_urls = list(previous_set - current_set)
    
    return new_urls, sold_urls

def auto_diagnose_and_fix(total_scraped: int, max_retries: int = 2):
    """
    スクレイピング完了後に自動診断し、エラーが検出された場合は自動的に再実行
    max_retries: 最大再試行回数（無限ループを防ぐ）
    """
    print(f"\n{'='*70}")
    print("自動診断を開始します...")
    print(f"{'='*70}\n")
    
    # 再試行回数をチェック（環境変数から取得、デフォルトは0）
    try:
        retry_count = max(0, int(os.getenv("AUTO_RETRY_COUNT", "0")))  # 負の値を0に正規化
    except (ValueError, TypeError):
        retry_count = 0  # 無効な値の場合は0に設定
    
    if retry_count >= max_retries:
        print(f"⚠️  最大再試行回数（{max_retries}回）に達しました。自動修正をスキップします。")
        return
    
    if db.db_type != "supabase":
        print("⚠️  データベースタイプがSupabaseではないため、自動診断をスキップします。")
        return
    
    try:
        # スクレイピング実行時刻の前後30分の範囲で確認
        # GitHub ActionsはUTCで実行されるため、UTC時刻を使用
        now = datetime.now(timezone.utc)
        check_start = (now - timedelta(minutes=30)).isoformat()
        check_end = (now + timedelta(minutes=30)).isoformat()
        
        result = db.supabase.table("properties")\
            .select("*", count="exact", head=True)\
            .gte("created_at", check_start)\
            .lte("created_at", check_end)\
            .execute()
        
        saved_count = result.count if hasattr(result, 'count') else (len(result.data) if result.data else 0)
        
        print(f"📊 診断結果:")
        print(f"   スクレイピング件数: {total_scraped}件")
        print(f"   Supabase保存件数: {saved_count}件")
        print(f"   チェック範囲: {check_start} 〜 {check_end}")
        
        if total_scraped == 0:
            print("   ✓ スクレイピング件数が0件のため、診断をスキップします。")
            return
        
        # 異常ケース: 保存件数がスクレイピング件数を超える場合
        if saved_count > total_scraped:
            print(f"   ⚠️  警告: 保存件数（{saved_count}件）がスクレイピング件数（{total_scraped}件）を超えています。")
            print(f"   これは、タイムゾーン範囲内に他の実行のデータが含まれている可能性があります。")
            print(f"   チェック範囲を確認してください。")
        
        save_rate = (saved_count / total_scraped * 100) if total_scraped > 0 else 0
        print(f"   保存率: {save_rate:.1f}%")
        
        # エラー判定: 保存率が10%未満の場合
        if save_rate < 10:
            print(f"\n❌ エラー検出: 保存率が10%未満です（{save_rate:.1f}%）")
            print(f"   自動的に再スクレイピングを実行します...")
            print(f"   再試行回数: {retry_count + 1}/{max_retries}")
            
            # 環境変数を設定して再実行
            # GitHub Actions環境では環境変数を明示的に設定
            retry_env = os.environ.copy()
            retry_env["AUTO_RETRY_COUNT"] = str(retry_count + 1)
            
            # 再スクレイピングを実行（--no-diffオプションで全件スクレイピング）
            import subprocess
            import sys
            
            script_path = os.path.abspath(__file__)
            command = [
                sys.executable,
                script_path,
                "--no-diff",  # 差分検出をスキップして全件スクレイピング
                "--skip-refresh",  # リンクは再収集しない（既存リンクを使用）
            ]
            
            print(f"\n🔄 再スクレイピングを開始します...")
            print(f"   コマンド: {' '.join(command)}")
            print(f"   環境変数 AUTO_RETRY_COUNT: {retry_env.get('AUTO_RETRY_COUNT', '0')}")
            
            # 再実行（環境変数を引き継ぐ）
            result = subprocess.run(
                command,
                cwd=os.path.dirname(script_path),
                env=retry_env,  # 環境変数を明示的に渡す
                capture_output=False,
                text=True
            )
            
            if result.returncode == 0:
                print(f"\n✓ 再スクレイピングが正常に完了しました。")
            else:
                print(f"\n❌ 再スクレイピングが失敗しました（終了コード: {result.returncode}）")
                # GitHub Actions環境では失敗時にエラーを出力
                if os.getenv("GITHUB_ACTIONS"):
                    print(f"::error::自動再スクレイピングが失敗しました（終了コード: {result.returncode}）")
        else:
            print(f"\n✓ 診断結果: 正常（保存率: {save_rate:.1f}%）")
            print(f"   自動修正は不要です。")
    
    except Exception as e:
        print(f"\n❌ 自動診断中にエラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        # GitHub Actions環境ではエラーを出力
        if os.getenv("GITHUB_ACTIONS"):
            print(f"::error::自動診断中にエラーが発生しました: {e}")
        # エラーが発生してもスクレイピング自体は成功として扱う
        return

# --- Main Execution ---
def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="沖縄不動産スクレイピングツール (Database版)")
    parser.add_argument("--force-refresh", action="store_true", 
                       help="強制的にリンクを再収集")
    parser.add_argument("--skip-refresh", action="store_true", 
                       help="更新チェックをスキップして既存リンクを使用")
    parser.add_argument("--no-diff", action="store_true",
                       help="差分検出をスキップして全物件をスクレイピング")
    args = parser.parse_args()
    
    print(f"\n{'='*70}")
    print(f"うちなーらいふ不動産スクレイピングツール - Database版")
    print(f"Database Type: {db.db_type.upper()}")
    print(f"{'='*70}\n")
    
    # Use separate Playwright instance for link collection
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
            ]
        )
        
        try:
            #  1. Check if we need to refresh links
            needs_refresh = should_refresh_links(LINKS_FILE, args.force_refresh, args.skip_refresh)
           
            # 2. Load or Collect Links
            all_links = {}
            
            if needs_refresh:
                print("Collecting fresh links for all categories...\n")
                for cat_name, cat_url in CATEGORIES.items():
                    links = collect_links(cat_name, cat_url, browser)
                    all_links[cat_name] = links
                    # Save incrementally with metadata (backup)
                    save_links_with_metadata(LINKS_FILE, all_links)
            else:
                print("Loading existing links...\n")
                all_links = load_links_with_metadata(LINKS_FILE)
                
                # Verify all categories exist
                missing_categories = [cat_name for cat_name in CATEGORIES.keys() 
                                    if cat_name not in all_links or not all_links[cat_name]]
                
                if missing_categories:
                    for cat_name in missing_categories:
                        print(f"[{cat_name}] Missing links, collecting...")
                        links = collect_links(cat_name, CATEGORIES[cat_name], browser)
                        all_links[cat_name] = links
                        save_links_with_metadata(LINKS_FILE, all_links)
                else:
                    for cat_name in CATEGORIES.keys():
                        print(f"[{cat_name}] Loaded {len(all_links[cat_name])} links")

        finally:
            browser.close()

    print(f"\n{'='*70}")
    print("Link Collection Complete")
    print(f"{'='*70}\n")

    # 3. Process each category with database integration
    total_new = 0
    total_sold = 0
    total_scraped = 0
    
    # Create a single executor for all categories to reuse threads/browsers
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for cat_name, links in all_links.items():
            print(f"\n{'='*70}", flush=True)
            print(f"Processing Category: {cat_name} ({GENRE_NAMES[cat_name]})", flush=True)
            print(f"{'='*70}", flush=True)
            print(f"Total URLs: {len(links)}", flush=True)
            
            # Save today's link snapshot to database
            db.save_link_snapshot(cat_name, links)
            print(f"✓ Saved link snapshot to database", flush=True)
            
            # Detect diff (new and sold properties)
            if not args.no_diff:
                new_urls, sold_urls = detect_diff(cat_name, links)
                print(f"\n📊 Diff Detection:", flush=True)
                print(f"  New properties: {len(new_urls)}", flush=True)
                print(f"  Sold properties: {len(sold_urls)}", flush=True)
                
                total_new += len(new_urls)
                total_sold += len(sold_urls)
                
                # Mark sold properties as inactive in database
                if sold_urls:
                    marked = db.mark_properties_inactive(sold_urls)
                    print(f"  ✓ Marked {marked} properties as sold", flush=True)
                
                # Only scrape NEW properties
                urls_to_scrape = new_urls
            else:
                print(f"\n⚠️  Diff detection skipped - will scrape all {len(links)} URLs", flush=True)
                urls_to_scrape = links
            
            # Load checkpoint
            processed_urls = load_checkpoint(CHECKPOINT_FILE, cat_name)
            if processed_urls:
                original_count = len(urls_to_scrape)
                urls_to_scrape = [u for u in urls_to_scrape if u not in processed_urls]
                print(f"  Skipping {original_count - len(urls_to_scrape)} already processed URLs (from checkpoint)", flush=True)

            if not urls_to_scrape:
                print(f"\n✓ No new properties to scrape for {cat_name}", flush=True)
                continue
            
            print(f"\n🔍 Scraping {len(urls_to_scrape)} properties for {cat_name}...", flush=True)
            sys.stdout.flush()
            
            # Scrape and save to database
            scraped_count = 0
            error_count = 0
            
            try:
                # Create scraping function with explicit cat_name capture to avoid closure issues
                current_category = cat_name  # Capture category name explicitly
                
                def make_scrape_func(category):
                    """Factory function to properly capture category in closure"""
                    def scrape_with_retry(url):
                        return retry_with_backoff(lambda: scrape_detail(url, category))
                    return scrape_with_retry
                
                scrape_func = make_scrape_func(current_category)
                
                print(f"  Submitting {len(urls_to_scrape)} URLs to thread pool...", flush=True)
                future_to_url = {executor.submit(scrape_func, url): url for url in urls_to_scrape}
                print(f"  Submitted. Waiting for completion...", flush=True)
                
                for future in as_completed(future_to_url):
                    url = future_to_url[future]
                    try:
                        data = future.result()
                        if data and "error" not in data:
                            # Transform to database format
                            db_record = transform_to_db_format(data, current_category)
                            
                            # Save to database
                            if db.upsert_property(db_record):
                                scraped_count += 1
                                # Update checkpoint
                                processed_urls.add(url)
                                if len(processed_urls) % 10 == 0:
                                    save_checkpoint(CHECKPOINT_FILE, current_category, processed_urls)
                            else:
                                error_count += 1
                        else:
                            error_count += 1
                            
                    except Exception as exc:
                        print(f"  ✗ Error scraping {url}: {exc}", flush=True)
                        error_count += 1
                    
                    # Progress update (every 10 items)
                    if (scraped_count + error_count) % 10 == 0:
                        print(f"  Progress: {scraped_count + error_count}/{len(urls_to_scrape)} (Success: {scraped_count}, Errors: {error_count})", flush=True)
                
                # Final checkpoint save for this category
                save_checkpoint(CHECKPOINT_FILE, current_category, processed_urls)
                
            except Exception as loop_error:
                print(f"\n❌ Critical error in scraping loop for {cat_name}: {loop_error}", flush=True)
                import traceback
                traceback.print_exc()
                sys.stdout.flush()
            
            total_scraped += scraped_count
            
            print(f"\n✓ Category {cat_name} complete:", flush=True)
            print(f"  Scraped: {scraped_count}", flush=True)
            print(f"  Errors: {error_count}", flush=True)

        # Cleanup threads
        print("\nCleaning up worker threads...")
        # Submit cleanup tasks to ensure all threads close their browsers
        # We submit more tasks than workers to ensure all threads pick one up
        cleanup_futures = [executor.submit(cleanup_thread_browser) for _ in range(MAX_WORKERS * 2)]
        for f in cleanup_futures:
            try:
                f.result()
            except:
                pass
    
    # Final summary
    print(f"\n{'='*70}", flush=True)
    print("SCRAPING COMPLETE", flush=True)
    print(f"{'='*70}", flush=True)
    print(f"Total new properties: {total_new}", flush=True)
    print(f"Total sold properties: {total_sold}", flush=True)
    print(f"Total scraped: {total_scraped}", flush=True)
    print(f"Database: {db.db_type.upper()}", flush=True)
    print(f"{'='*70}\n", flush=True)
    
    # Export to CSV
    export_to_csv()
    
    # Auto-diagnosis and auto-fix
    if db.db_type == "supabase":
        auto_diagnose_and_fix(total_scraped)

if __name__ == "__main__":
    main()