package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var (
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.RWMutex
	dbpool    *pgxpool.Pool
	aiQueue   = make(chan Incident, 5000)

	// Pre-allocate memory to prevent GC spikes
	batchPool = sync.Pool{
		New: func() any {
			b := make([]Incident, 0, 500)
			return &b
		},
	}
)

const (
	tickInterval = 200 * time.Millisecond
	port         = ":8080"
)

type Incident struct {
	ID        string  `json:"id"`
	Service   string  `json:"service"`
	Severity  string  `json:"severity"`
	Value     float64 `json:"value"`
	Timestamp int64   `json:"timestamp"`
	Message   string  `json:"message"`
}

var services = []string{"auth-service", "payment-gateway", "order-engine", "search-index"}
var severities = []string{"LOW", "MEDIUM", "HIGH", "CRITICAL"}
var msgs = []string{"DB timeout", "payment failure", "auth error", "cache spike"}

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024 * 4,
	WriteBufferSize: 1024 * 16,
}

func startEventStream() {
	ticker := time.NewTicker(tickInterval)
	for range ticker.C {
		batchPtr := batchPool.Get().(*[]Incident)
		batch := (*batchPtr)[:0]

		for i := 0; i < 10; i++ { // changing from 400 to 10 to manage system load
			inc := generateIncident()
			batch = append(batch, inc)
			if inc.Severity == "CRITICAL" {
				go saveToDB(inc)
				select {
				case aiQueue <- inc:
				default:
				}
			}
		}

		clientsMu.RLock()
		for client := range clients {
			client.SetWriteDeadline(time.Now().Add(150 * time.Millisecond))
			if err := client.WriteJSON(batch); err != nil {
				client.Close()
			}
		}
		clientsMu.RUnlock()
		batchPool.Put(batchPtr)
	}
}

func generateIncident() Incident {
	return Incident{
		ID:        uuid.New().String(),
		Service:   services[rand.Intn(len(services))],
		Severity:  severities[rand.Intn(len(severities))],
		Value:     rand.Float64() * 100,
		Timestamp: time.Now().UnixMilli(),
		Message:   msgs[rand.Intn(len(msgs))],
	}
}

func saveToDB(inc Incident) {
	if dbpool == nil {
		return
	}
	meta := fmt.Sprintf(`{"value":%.2f}`, inc.Value)
	query := "INSERT INTO incidents (source, severity, message, metadata, id_custom) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING"
	_, err := dbpool.Exec(context.Background(), query, inc.Service, inc.Severity, inc.Message, meta, inc.ID)
	if err != nil {
		log.Printf("Save Error: %v", err)
	}
}

func main() {
	// Load .env for local native run
	godotenv.Load()
	rand.Seed(time.Now().UnixNano())

	// Set Gin to release mode to save CPU/RAM on your 8GB system
	gin.SetMode(gin.ReleaseMode)

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		config, err := pgxpool.ParseConfig(dbURL)
		if err != nil {
			log.Fatalf("Unable to parse DB URL: %v", err)
		}
		config.MaxConns = 15 // Lowered slightly for native HDD stability
		dbpool, err = pgxpool.NewWithConfig(context.Background(), config)
		if err != nil {
			log.Printf("DB Connection Failed: %v", err)
		} else {
			log.Println("✅ Connected to Supabase Successfully")
		}
	}

	go startEventStream()

	r := gin.New()
	r.Use(gin.Recovery())

	// Native CORS handling for your Vue Dev Server (localhost:5173)
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// --- NEW SEARCH ENDPOINT ---
	r.GET("/api/search", func(c *gin.Context) {
		queryText := c.Query("q")
		if queryText == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No query provided"})
			return
		}

		log.Printf("🔍 Searching for: %s", queryText)

		if dbpool == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
			return
		}

		// Initial Search Logic: Standard text search to verify flow.
		// Once verified, swap this to vector search:
		// ORDER BY embedding <=> (your_query_vector)
		rows, err := dbpool.Query(context.Background(),
			"SELECT id_custom, source, severity, message FROM incidents WHERE message ILIKE $1 OR source ILIKE $1 LIMIT 20",
			"%"+queryText+"%")

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Query failed"})
			return
		}
		defer rows.Close()

		var results []Incident
		for rows.Next() {
			var inc Incident
			if err := rows.Scan(&inc.ID, &inc.Service, &inc.Severity, &inc.Message); err == nil {
				results = append(results, inc)
			}
		}

		c.JSON(http.StatusOK, results)
	})

	r.GET("/ws", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		clientsMu.Lock()
		clients[conn] = true
		clientsMu.Unlock()

		conn.SetCloseHandler(func(code int, text string) error {
			clientsMu.Lock()
			delete(clients, conn)
			clientsMu.Unlock()
			return nil
		})
	})

	log.Println("🚀 AEGIS Backend Running Natively on http://localhost:8080")
	r.Run(port)
}
