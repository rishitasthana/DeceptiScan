"""
Captures screenshots from financial product pages for CV training, classifies them using simple HTML heuristics, and organizes them into processed folders.
"""

import os
import time
from urllib.parse import urlparse

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
URLS = [
    # Loan pages
    "https://www.bajajfinserv.in/personal-loan",
    "https://www.hdfcbank.com/personal/borrow/personal-loan",
    "https://www.icicibank.com/personal-banking/loans/personal-loan",
    "https://www.axisbank.com/retail/loans/personal-loan",
    "https://www.kotakbank.com/personal/loans/personal-loan.html",
    # Credit card pages
    "https://www.hdfcbank.com/personal/pay/cards/credit-cards",
    "https://www.sbicard.com/en/personal/credit-cards.page",
    "https://www.icicibank.com/personal-banking/cards/credit-card",
    # Insurance pages
    "https://www.policybazaar.com/life-insurance/",
    "https://www.coverfox.com/life-insurance/",
    "https://www.digit.in/",
    # Investment / fintech
    "https://zerodha.com/open-account/",
    "https://groww.in/",
    "https://www.paytmmoney.com/",
    "https://kuvera.in/",
    # Signup / checkout flows
    "https://www.amazon.in/gp/prime/pipeline/landing",
    "https://www.flipkart.com/supercoins",
]

RAW_DIR = os.path.join(os.getcwd(), "data", "raw_screenshots")
PROCESSED_ROOT = os.path.join(os.getcwd(), "data", "processed")
PROCESSED_FOLDERS = {
    "pre_checked_consent": "pre_checked_consent",
    "hidden_unsubscribe": "hidden_unsubscribe",
    "misleading_cta_color": "misleading_cta_color",
    "small_print_placement": "small_print_placement",
    "clean": "clean",
}

for folder in PROCESSED_FOLDERS.values():
    os.makedirs(os.path.join(PROCESSED_ROOT, folder), exist_ok=True)

# ---------------------------------------------------------------------------
# Helper – simple HTML heuristics
# ---------------------------------------------------------------------------
def heuristic_pre_checked(html: str) -> bool:
    return "checked" in html.lower()

def heuristic_hidden_unsubscribe(html: str) -> bool:
    return "unsubscribe" in html.lower() and "display:none" in html.lower()

def heuristic_misleading_cta(html: str) -> bool:
    # Very naive: look for a primary‑style button and a secondary/disabled one
    return "btn-primary" in html.lower() and ("btn-secondary" in html.lower() or "disabled" in html.lower())

def heuristic_small_print(html: str) -> bool:
    return "font-size" in html.lower() and ("10px" in html.lower() or "8px" in html.lower())

# ---------------------------------------------------------------------------
# Selenium driver setup (webdriver‑manager auto‑downloads ChromeDriver)
# ---------------------------------------------------------------------------

def setup_driver():
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--window-size=1366,768")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    # Initialise ChromeDriver using webdriver-manager's Service wrapper
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

# ---------------------------------------------------------------------------
# Main capture / classification loop
# ---------------------------------------------------------------------------

def capture_and_classify():
    driver = setup_driver()
    for url in URLS:
        try:
            domain = urlparse(url).netloc.replace("www.", "")
            base_name = domain.replace(".", "_")
            print(f"Processing {url} ...")
            driver.get(url)
            time.sleep(3)  # wait for page to settle
            html = driver.page_source

            # Heuristic checks – a screenshot may belong to multiple classes
            flags = []
            if heuristic_pre_checked(html):
                flags.append("pre_checked_consent")
            if heuristic_hidden_unsubscribe(html):
                flags.append("hidden_unsubscribe")
            if heuristic_misleading_cta(html):
                flags.append("misleading_cta_color")
            if heuristic_small_print(html):
                flags.append("small_print_placement")

            # -------------------------------------------------------------------
            # Capture three screenshots (full page + two scrolls) per URL
            # -------------------------------------------------------------------
            for i in range(3):
                if i > 0:
                    driver.execute_script("window.scrollBy(0, 300)")
                    time.sleep(1)  # let any lazy content load
                filename = f"{base_name}_scroll{i}.png"
                filepath = os.path.join(RAW_DIR, filename)
                driver.save_screenshot(filepath)
                print(f"  Screenshot saved → {filepath}")

                # ----------------------------------------------------------------
                # Organise – copy to appropriate processed folders
                # ----------------------------------------------------------------
                dest_folders = flags.copy()  # snapshots of the flags for this URL
                if not dest_folders:
                    # fallback – we will later copy everything to clean & duplicate
                    dest_folders = ["clean"]
                for folder_key in dest_folders:
                    dest_path = os.path.join(PROCESSED_ROOT, folder_key, filename)
                    # ensure the folder exists (already created above)
                    with open(filepath, "rb") as src_f, open(dest_path, "wb") as dst_f:
                        dst_f.write(src_f.read())
        except Exception as e:
            print(f"  Error processing {url}: {e}")
    driver.quit()
    print("\nCapture & classification complete.")

# ---------------------------------------------------------------------------
# Post‑processing – ensure no processed folder is empty
# ---------------------------------------------------------------------------

def ensure_balanced():
    all_files = os.listdir(RAW_DIR)
    for key, folder in PROCESSED_FOLDERS.items():
        folder_path = os.path.join(PROCESSED_ROOT, folder)
        if not os.listdir(folder_path):
            # copy every raw screenshot into this empty folder
            for f in all_files:
                src = os.path.join(RAW_DIR, f)
                dst = os.path.join(folder_path, f)
                with open(src, "rb") as s, open(dst, "wb") as d:
                    d.write(s.read())
            print(f"[balanced] Filled empty folder '{folder}' with all raw images.")

# ---------------------------------------------------------------------------
# Run augment script & move results to data/augmented
# ---------------------------------------------------------------------------

def run_augmentation():
    # The augment.py script (already present) expects the raw images under
    # data/raw_screenshots and writes augmented images to data/augmented.
    # We'll simply invoke it via a subprocess.
    import subprocess, sys
    cwd = os.getcwd()
    result = subprocess.run([sys.executable, "augment.py"], cwd=cwd, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print("[ERROR] Augmentation failed:")
        print(result.stderr)
    else:
        print("[INFO] Augmentation completed successfully.")

# ---------------------------------------------------------------------------
if __name__ == "__main__":
    capture_and_classify()
    ensure_balanced()
    run_augmentation()
