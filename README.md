PropTrack: AI-Powered Incident Intelligence
Project Status: Day 27/30 — AI Intelligence & Supabase Integration FinalizedA high-performance observability platform built to transform raw log noise into searchable, semantic intelligence.⚡

**Project Status:** `Day 27/30` — **AI Intelligence & Supabase Integration Finalized**

---

### ⚡ Performance Snapshot

| Metric                       | Specification        | Status              |
| :--------------------------- | :------------------- | :------------------ |
| **Architectural Throughput** | 15k – 70k events/sec | 🚀 Optimized        |
| **Local Throughput**         | ~800 events/sec      | 💻 Hardware Limited |
| **Frontend Smoothness**      | 55 – 60 FPS          | ✨ Stable           |
| **Vector Database**          | Managed pgvector     | ⚡ Supabase Cloud   |

---

### 🏗️ System Architecture

The architecture leverages a hybrid-cloud approach: Local Go-concurrency for high-speed streaming and Supabase for persistent semantic memory.

```mermaid
graph TD
    subgraph Client_Side
    Vue[Vue 3 SPA] --> Pinia[Pinia Store]
    Pinia --> RS[Recycle Scroller]
    Pinia --> EC[ECharts Analytics]
    end

    subgraph Server_Side
    Go[Go Gin Server] --> WS[WebSocket Engine]
    Go --> AI[Neural Search API]
    end

    subgraph Cloud_Data_Layer
    DB[(Supabase + pgvector)]
    DB --> HNSW[HNSW Vector Index]
    end

    WS -- Stream --> Vue
    AI -- rpc:match_incidents --> DB
    Vue -- Query --> AI
⚙️ Core Technical Specifications🔄 Real-Time Streaming: High-concurrency Go (Gin) server utilizing a single-handler WebSocket pattern for efficient event distribution.🧠 AI & Semantic Search: Log messages vectorized via HuggingFace MiniLM. Neural search overlay (/) performs sub-millisecond similarity lookups.🗄️ Supabase Cloud: Managed pgvector storage with HNSW indexing to ensure $O(\log n)$ search complexity.⚡ Non-Blocking UI: Heavy data sorting offloaded to Web Workers; rendering optimized via row recycling (60 FPS at 10k+ rows).🛠️ Tech StackFrontend: Vue 3, TypeScript, Pinia, ECharts.Backend: Go (Gin), Gorilla WebSocket.Cloud/Data: Supabase (PostgreSQL + pgvector), Docker.🏁 Milestone Tracker[x] High-concurrency Go WebSocket engine[x] Virtualized frontend dashboard (60 FPS)[x] Supabase / pgvector Integration[x] Neural Search Engine (Command Palette)[x] ECharts Risk Trend Visualization[x] Docker Containerization (Local Stack)[ ] Next: Cloud Deployment (Vercel + Railway)[ ] Next: File splitting & modularization polish🚀 Getting Started1. BackendBashcd backend/cmd
go run main.go
2. FrontendBashnpm install
npm run dev
```
