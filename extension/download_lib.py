import urllib.request
import os

url = "https://html2canvas.hertzen.com/dist/html2canvas.min.js"
lib_dir = os.path.join(os.path.dirname(__file__), "lib")
os.makedirs(lib_dir, exist_ok=True)
dest = os.path.join(lib_dir, "html2canvas.min.js")

print(f"Downloading {url} to {dest}...")
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
)
with urllib.request.urlopen(req) as response:
    with open(dest, 'wb') as f:
        f.write(response.read())
print("Done!")
