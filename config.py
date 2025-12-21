"""
設定ファイル - うちなーらいふ不動産スクレイピングシステム

ハードコードされた値を一元管理するための設定ファイル
環境変数で上書き可能
"""

import os
from typing import Dict


class Config:
    """スクレイピングシステムの設定クラス"""
    
    # =====================================================
    # 基本設定
    # =====================================================
    BASE_URL: str = "https://www.e-uchina.net"
    OUTPUT_DIR: str = "output"
    LINKS_FILE: str = os.path.join(OUTPUT_DIR, "links.json")
    CHECKPOINT_FILE: str = os.path.join(OUTPUT_DIR, "checkpoint.json")
    
    # =====================================================
    # スクレイピング設定
    # =====================================================
    MAX_WORKERS: int = int(os.getenv("SCRAPER_MAX_WORKERS", "4"))  # Increased to 4 for faster scraping
    ITEMS_PER_PAGE: int = int(os.getenv("SCRAPER_ITEMS_PER_PAGE", "50"))
    MAX_PAGES_PER_CATEGORY: int = int(os.getenv("SCRAPER_MAX_PAGES", "150"))  # Increased to handle large categories
    HEADLESS_MODE: bool = os.getenv("SCRAPER_HEADLESS", "true").lower() == "true"
    
    # =====================================================
    # レート制限設定
    # =====================================================
    MAX_REQUESTS_PER_SECOND: int = int(os.getenv("SCRAPER_MAX_RPS", "5"))
    BURST_SIZE: int = int(os.getenv("SCRAPER_BURST_SIZE", "5"))
    BURST_WINDOW: int = int(os.getenv("SCRAPER_BURST_WINDOW", "2"))
    
    # =====================================================
    # リトライ設定
    # =====================================================
    MAX_RETRIES: int = int(os.getenv("SCRAPER_MAX_RETRIES", "3"))
    BASE_RETRY_DELAY: int = int(os.getenv("SCRAPER_RETRY_DELAY", "2"))
    
    # =====================================================
    # ブラウザ設定
    # =====================================================
    MAX_BROWSER_USES: int = int(os.getenv("SCRAPER_MAX_BROWSER_USES", "50"))
    
    # =====================================================
    # カテゴリー設定
    # =====================================================
    CATEGORIES: Dict[str, str] = {
        # 賃貸
        "jukyo": f"{BASE_URL}/jukyo",
        "jigyo": f"{BASE_URL}/jigyo",
        "yard": f"{BASE_URL}/yard",
        "parking": f"{BASE_URL}/parking",
        # 売買
        "tochi": f"{BASE_URL}/tochi",
        "mansion": f"{BASE_URL}/mansion",
        "house": f"{BASE_URL}/house",
        "sonota": f"{BASE_URL}/sonota"
    }
    
    # =====================================================
    # カテゴリー日本語名
    # =====================================================
    CATEGORY_NAMES: Dict[str, str] = {
        "jukyo": "賃貸",
        "jigyo": "賃貸",
        "yard": "賃貸",
        "parking": "賃貸",
        "tochi": "売買",
        "mansion": "売買",
        "house": "売買",
        "sonota": "売買"
    }
    
    GENRE_NAMES: Dict[str, str] = {
        "jukyo": "住居",
        "jigyo": "事業用",
        "yard": "月極駐車場",
        "parking": "時間貸駐車場",
        "tochi": "土地",
        "mansion": "マンション",
        "house": "戸建",
        "sonota": "その他"
    }
    
    # =====================================================
    # データベース設定
    # =====================================================
    DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "supabase")
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "output/properties.db")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    
    # =====================================================
    # APIサーバー設定
    # =====================================================
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "5000"))
    API_DEBUG: bool = os.getenv("API_DEBUG", "true").lower() == "true"
    
    # =====================================================
    # ログ設定
    # =====================================================
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = "logs"
    LOG_FILE: str = os.path.join(LOG_DIR, "scraper.log")
    ERROR_LOG_FILE: str = os.path.join(LOG_DIR, "scraper_error.log")
    
    @classmethod
    def validate(cls) -> bool:
        """設定の妥当性を検証"""
        if cls.DATABASE_TYPE == "supabase":
            if not cls.SUPABASE_URL or not cls.SUPABASE_ANON_KEY:
                raise ValueError(
                    "DATABASE_TYPE が 'supabase' の場合、"
                    "SUPABASE_URL と SUPABASE_ANON_KEY が必要です"
                )
        return True
    
    @classmethod
    def display(cls) -> None:
        """現在の設定を表示"""
        print(f"\n{'='*70}")
        print("現在の設定")
        print(f"{'='*70}")
        print(f"データベース: {cls.DATABASE_TYPE}")
        print(f"最大ワーカー数: {cls.MAX_WORKERS}")
        print(f"最大RPS: {cls.MAX_REQUESTS_PER_SECOND}")
        print(f"ヘッドレスモード: {cls.HEADLESS_MODE}")
        print(f"APIサーバー: {cls.API_HOST}:{cls.API_PORT}")
        print(f"{'='*70}\n")


# グローバル設定インスタンス
config = Config()

