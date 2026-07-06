# DeceptiScan - Dark Pattern Detector for Financial Products

A full-stack ML system that detects manipulative dark patterns in financial product websites (credit cards, loans, insurance apps) in real time.

## Architecture

```
Chrome Extension (MV3)
  ↓  POST /analyze/full
FastAPI Backend
  ├── NLP Service (Legal-BERT)  → classifies T&C clauses
  ├── CV Service  (ResNet-50)   → classifies UI screenshots
  ├── Fusion Service            → risk score 1–10
  ├── MongoDB                   → scan history, reports
  ├── Redis / Celery            → caching, async tasks
  └── Pinecone / ChromaDB       → RAG clause search
Admin UI (React + Vite)
  ├── Dashboard   → all scanned domains + risk scores
  ├── Flag Queue  → approve/reject community reports
  └── Model Metrics → precision/recall/F1 per label
```

---

## 🚀 Quick Start

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts MongoDB (port 27017) and Redis (port 6379).

---

### 2. Backend Setup

```bash
cd backend

# Copy and edit environment variables
cp .env.example .env

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

### 3. ML Model Training (Optional — mock inference works without this)

```bash
cd ml
pip install -r requirements.txt

# NLP model dry-run test
python nlp/train.py --dry-run

# Full NLP training (requires GPU recommended)
python nlp/train.py --epochs 10

# CV model dry-run test
python cv/train.py --dry-run

# Full CV training
python cv/train.py --epochs 15 --samples-per-class 200
```

After training, run evaluation:
```bash
python nlp/evaluate.py
python cv/evaluate.py
```

---

### 4. Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` directory

> **Note**: You need to download `html2canvas.min.js` and place it in `extension/lib/`:
> ```
> curl -L https://html2canvas.hertzen.com/dist/html2canvas.min.js -o extension/lib/html2canvas.min.js
> ```

---

### 5. Admin UI

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5173

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze/text` | NLP analysis of T&C text |
| `POST` | `/analyze/screenshot` | CV analysis of UI screenshot |
| `POST` | `/analyze/full` | Full analysis (NLP + CV + fusion) |
| `GET`  | `/rag/ask?q=...` | RAG Q&A over indexed clauses |
| `GET`  | `/products` | List all scanned domains |
| `GET`  | `/products/{domain}` | Scan history for a domain |
| `POST` | `/community/report` | Submit a dark pattern report |
| `GET`  | `/community/reports` | List reports (admin) |
| `PATCH`| `/community/report/{id}/approve` | Approve report (admin) |
| `PATCH`| `/community/report/{id}/reject` | Reject report (admin) |
| `GET`  | `/report/pdf/{scan_id}` | Download PDF report |
| `GET`  | `/report/metrics` | NLP + CV model metrics |
| `GET`  | `/health` | Health check |

---

## 🤖 ML Models

### NLP: Legal-BERT Multi-label Classifier

- **Base model**: `nlpaueb/legal-bert-base-uncased`
- **Task**: Multi-label classification of T&C clauses
- **Labels**: `fee_burial`, `auto_renewal_trap`, `urgency_language`, `ambiguous_opt_out`, `misleading_free`, `clean`
- **Training**: `ml/nlp/train.py`
- **Weights**: Place in `ml/weights/nlp_model/`

### CV: ResNet-50 Screenshot Classifier

- **Base model**: ImageNet pretrained ResNet-50
- **Task**: Multi-label classification of UI screenshots
- **Labels**: `pre_checked_consent`, `hidden_unsubscribe`, `misleading_cta_color`, `small_print_placement`, `clean`
- **Training**: `ml/cv/train.py`
- **Weights**: Place in `ml/weights/cv_model/cv_model.pt`

Both models fall back to **heuristic mock classifiers** when weights are absent, so the entire system works end-to-end without training.

---

## 🔧 Environment Variables

See `backend/.env.example` for all options. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `USE_LOCAL_VECTOR_DB` | `true` | Use ChromaDB (no Pinecone key needed) |
| `PINECONE_API_KEY` | *(empty)* | Set to use Pinecone instead |
| `USE_LOCAL_STORAGE` | `true` | Use local filesystem (no S3 key needed) |
| `NLP_WEIGHT` | `0.6` | NLP contribution to risk score |
| `CV_WEIGHT` | `0.4` | CV contribution to risk score |
| `ADMIN_API_KEY` | `dev-secret-change-me` | Admin endpoint auth key |

---

## 🧪 Running Tests

```bash
cd backend
pytest tests/ -v --asyncio-mode=auto
```

---

## 📁 Project Structure

```
dark-pattern-detector/
├── backend/          FastAPI backend
├── ml/               ML training & inference
│   ├── nlp/          Legal-BERT NLP classifier
│   └── cv/           ResNet-50 CV classifier
├── extension/        Chrome Extension (MV3)
├── admin/            React + Vite Admin UI
├── docker-compose.yml
└── README.md
```
