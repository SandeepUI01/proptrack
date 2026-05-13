package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// ------------------ GLOBALS ------------------

var (
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex
	dbpool    *pgxpool.Pool
	aiQueue   = make(chan Incident, 200)
)

const (
	tickInterval = 800 * time.Millisecond
	port         = ":8080"
)

// ------------------ DATA ------------------

var services = []string{
	"auth-service",
	"payment-gateway",
	"order-engine",
	"search-index",
}

var severities = []string{"LOW", "MEDIUM", "HIGH", "CRITICAL"}

type Incident struct {
	ID        string  `json:"id"`
	Service   string  `json:"service"`
	Severity  string  `json:"severity"`
	Value     float64 `json:"value"`
	Timestamp int64   `json:"timestamp"`
	Message   string  `json:"message"`
}

type SearchResult struct {
	ID         string  `json:"id"`
	Message    string  `json:"message"`
	Service    string  `json:"service"` // Matches 'source' in DB
	Severity   string  `json:"severity"`
	Value      float64 `json:"value"` // Matches 'metadata' in DB
	Similarity float64 `json:"similarity"`
}

// ------------------ WS ------------------

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ------------------ VECTOR UTILS ------------------

func normalize(vec []float32) []float32 {
	var sum float64
	for _, v := range vec {
		sum += float64(v * v)
	}
	if sum == 0 {
		return vec
	}
	norm := float32(1.0 / math.Sqrt(sum))
	for i := range vec {
		vec[i] *= norm
	}
	return vec
}

func vectorToPG(vec []float32) string {
	var sb strings.Builder
	sb.WriteString("[")
	for i, v := range vec {
		sb.WriteString(fmt.Sprintf("%f", v))
		if i < len(vec)-1 {
			sb.WriteString(",")
		}
	}
	sb.WriteString("]")
	return sb.String()
}

// ------------------ CORS ------------------

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

// ------------------ EMBEDDING (FIXED FOR 2026) ------------------

func getEmbedding(text string) ([]float32, error) {
	apiKey := os.Getenv("HUGGINGFACE_TOKEN")
	if apiKey == "" {
		apiKey = os.Getenv("HUGGINGFACE_API_KEY")
	}

	// 🟢 FIX: Explicitly add the task to the URL path
	modelID := "sentence-transformers/all-MiniLM-L6-v2"
	url := "https://router.huggingface.co/hf-inference/models/" + modelID + "/pipeline/feature-extraction"

	// 🟢 FIX: Ensure inputs is a single string or slice of strings
	payload, _ := json.Marshal(map[string]any{
		"inputs": strings.ReplaceAll(text, "_", " "),
		"options": map[string]any{
			"wait_for_model": true,
		},
	})

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Wait-For-Model", "true")

	client := &http.Client{Timeout: 60 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("HF Error (%d): %s", res.StatusCode, string(body))
	}

	// The response for feature-extraction is usually a 1D or 2D array
	var raw any
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		return nil, err
	}

	switch v := raw.(type) {
	case []any:
		// Check if it's nested: [[0.1, 0.2]]
		if len(v) > 0 {
			if first, ok := v[0].([]any); ok {
				return toFloat32(first), nil
			}
		}
		return toFloat32(v), nil
	case [][]any:
		if len(v) > 0 {
			return toFloat32(v[0]), nil
		}
	}

	return nil, fmt.Errorf("unexpected embedding format from HF")
}

func toFloat32(arr []any) []float32 {
	out := make([]float32, len(arr))
	for i, v := range arr {
		switch val := v.(type) {
		case float64:
			out[i] = float32(val)
		case float32:
			out[i] = val
		case int:
			out[i] = float32(val)
		}
	}
	return out
}

// ------------------ HANDLERS ------------------

func handleSearch(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(400, gin.H{"error": "missing query"})
		return
	}

	if dbpool == nil {
		c.JSON(500, gin.H{"error": "db not ready"})
		return
	}

	vec, err := getEmbedding(q)
	if err != nil {
		log.Println("Embedding failed:", err)
		c.JSON(500, gin.H{"error": "embedding failed"})
		return
	}

	vec = normalize(vec)
	pgVec := vectorToPG(vec)

	rows, err := dbpool.Query(context.Background(),
		"SELECT id_custom, message, source, severity, metadata, similarity FROM match_incidents($1::vector, $2::float8, $3::int)",
		pgVec, 0.2, 10,
	)

	if err != nil {
		log.Println("search error:", err)
		c.JSON(500, gin.H{"error": "search failed"})
		return
	}
	defer rows.Close()

	results := []SearchResult{}
	seen := make(map[string]bool)

	for rows.Next() {
		var r SearchResult
		var metadata map[string]interface{}

		if err := rows.Scan(&r.ID, &r.Message, &r.Service, &r.Severity, &metadata, &r.Similarity); err != nil {
			continue
		}

		if seen[r.Message] {
			continue
		}
		seen[r.Message] = true

		if val, ok := metadata["value"].(float64); ok {
			r.Value = val
		}
		results = append(results, r)
	}

	c.JSON(200, results)
}

// ------------------ INCIDENT LOGIC ------------------

func generateIncident() Incident {
	msgs := []string{
		"DB timeout", "payment failure", "auth error",
		"cache spike", "payment gateway connection issue", "order processing delay",
	}

	return Incident{
		ID:        uuid.New().String(),
		Service:   services[rand.Intn(len(services))],
		Severity:  severities[rand.Intn(len(severities))],
		Value:     rand.Float64() * 100,
		Timestamp: time.Now().Unix(),
		Message:   msgs[rand.Intn(len(msgs))],
	}
}

func startEventStream() {
	t := time.NewTicker(tickInterval)
	for range t.C {
		batch := make([]Incident, 5)
		for i := 0; i < 5; i++ {
			inc := generateIncident()
			batch[i] = inc

			if inc.Severity == "HIGH" || inc.Severity == "CRITICAL" {
				go saveToDB(inc)
				select {
				case aiQueue <- inc:
				default:
				}
			}
		}

		clientsMu.Lock()
		for c := range clients {
			_ = c.WriteJSON(batch)
		}
		clientsMu.Unlock()
	}
}

func saveToDB(inc Incident) {
	if dbpool == nil {
		return
	}
	meta := fmt.Sprintf(`{"value":%.2f}`, inc.Value)
	query := `
        INSERT INTO incidents (source, severity, message, metadata, id_custom)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id_custom) DO NOTHING
    `
	_, err := dbpool.Exec(context.Background(), query, inc.Service, inc.Severity, inc.Message, meta, inc.ID)
	if err != nil {
		log.Println("DB error:", err)
	}
}

func startAIWorker() {
	for inc := range aiQueue {
		vec, err := getEmbedding(inc.Message)
		if err != nil {
			continue
		}

		vec = normalize(vec)
		pgVec := vectorToPG(vec)

		if dbpool != nil {
			_, err := dbpool.Exec(context.Background(),
				`UPDATE incidents SET embedding=$1 WHERE id_custom=$2`,
				pgVec, inc.ID,
			)
			if err != nil {
				log.Println("update error:", err)
			}
		}
	}
}

// ------------------ MAIN ------------------

func main() {
	godotenv.Load()

	config, err := pgxpool.ParseConfig(strings.TrimSpace(os.Getenv("DATABASE_URL")))
	if err != nil {
		panic(err)
	}

	config.MaxConns = 5
	config.MinConns = 1

	dbpool, err = pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		panic(err)
	}

	rand.Seed(time.Now().UnixNano())

	r := gin.Default()
	r.Use(corsMiddleware())

	r.GET("/ws", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		clientsMu.Lock()
		clients[conn] = true
		clientsMu.Unlock()
	})

	r.GET("/api/search", handleSearch)

	go startAIWorker()
	go startEventStream()

	fmt.Println("🚀 running on http://localhost:8080")
	r.Run(port)
}
