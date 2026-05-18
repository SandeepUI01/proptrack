PropTrack: AI-Powered Incident Intelligence
Project Status: Day 27/30 — AI Intelligence & Cloud Data Integration Finalized

A high-performance observability platform built to transform raw log noise into searchable, semantic intelligence. ⚡
⚡ Performance Snapshot
Metric Specification Status
Architectural Throughput 15k – 70k events/sec (Load Tested) 🚀 Validated
Local Ingestion Rate ~375 events/sec (Optimized) 💻 Hardware Stable
Frontend UI Performance 52 – 60 FPS (10k+ active rows) ✨ Stable via Web Worker
Vector Database Latency Sub-millisecond similarity lookup ⚡ Cloud Database + HNSW
🏗️ System Architecture

The architecture leverages a hybrid-cloud approach: local Go-concurrency for high-speed streaming, deep thread-isolation on the frontend, and an optimized cloud database layer for persistent semantic memory.
Code snippet

graph TD
subgraph Client_Side [Client Side - Vue 3 SPA]
Vue[Vue 3 Engine] --> Pinia[Pinia Store]
Pinia --> Worker[Web Worker: Sorting/Filtering]
Pinia --> RS[Recycle Scroller]
Pinia --> EC[ECharts Analytics]
end

    subgraph Server_Side [Server Side - Go Ecosystem]
        Go[Go Gin Server] --> WS[WebSocket Engine]
        Go --> AI[HuggingFace Embeddings API]
    end

    subgraph Cloud_Data_Layer [Cloud Data Layer]
        DB[(Cloud DB + pgvector)] --> HNSW[HNSW Vector Index]
    end

    WS -- "JSON Stream (~375 ev/s)" --> Vue
    Vue -- "RPC Search Query" --> DB
    Go -- "Batch Vectorization" --> AI
    AI -- "Vector Upsert" --> DB

⚙️ Core Technical Specifications

    🔄 Real-Time Streaming: High-concurrency Go server utilizing a single-handler WebSocket pattern for efficient event distribution with integrated backpressure management.

    🧠 AI & Semantic Search: Log messages vectorized via HuggingFace MiniLM models. A neural search overlay allows users to perform sub-millisecond similarity lookups instantly.

    🗄️ Cloud Vector Storage: Managed PostgreSQL pgvector storage utilizing Hierarchical Navigable Small World (HNSW) indexing to ensure O(logn) search complexity under massive scaling loads.

    ⚡ Non-Blocking UI Layout: Heavy sorting and filtering data mutations are entirely offloaded to background Web Workers. Rendering is optimized via a virtualized DOM to guarantee zero Main-Thread Long Tasks and rock-solid frame rates.

🛠️ Tech Stack

    Frontend: Vue 3 (Composition API), TypeScript, Pinia, TailwindCSS, Vue Virtual Scroller, ECharts.

    Backend: Go (Golang), Gin Gonic Framework, Gorilla WebSocket, pgx pool.

    Cloud/Data: PostgreSQL + pgvector, HuggingFace Inference API.

### 🚀 Getting Started

This platform supports two runtime modes: **Native Mode** (optimized to bypass container virtualization layers for maximum local stress-testing throughput) and **Docker Mode** (for containerized isolation and cloud-ready deployment).

#### Option A: Native Development Mode (Recommended for Local Benchmarking)

##### 1. Spin Up the Go Streaming Engine

```bash
cd backend/cmd
go run main.go

2. Launch the Thread-Isolated Frontend UI
Bash

cd frontend
npm install
npm run dev

Option B: Docker Containerized Mode (Production Setup)

The project includes multi-stage Docker configurations to keep production images lightweight and secure.
1. Build and Run the Complete Stack
Bash

# From the project root directory
docker-compose up --build
```
