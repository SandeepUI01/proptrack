package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

var (
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex
	dbpool    *pgxpool.Pool
	aiQueue   = make(chan Incident, 200)
)

const tickInterval = 800 * time.Millisecond

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
	Service    string  `json:"service"`
	Severity   string  `json:"severity"`
	Value      float64 `json:"value"`
	Similarity float64 `json:"similarity"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ------------------ UTILS ------------------

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

func getEmbedding(text string) ([]float32, error) {
	apiKey := os.Getenv("HUGGINGFACE_TOKEN")
	modelID := "sentence-transformers/all-MiniLM-L6-v2"
	url := "https://router.huggingface.co/hf-inference/models/" + modelID + "/pipeline/feature-extraction"

	payload, _ := json.Marshal(map[string]any{
		"inputs":  strings.ReplaceAll(text, "_", " "),
		"options": map[string]any{"wait_for_model": true},
	})

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var raw any
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		return nil, err
	}

	switch v := raw.(type) {
	case []any:
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
	return nil, fmt.Errorf("unexpected format")
}

func toFloat32(arr []any) []float32 {
	out := make([]float32, len(arr))
	for i, v := range arr {
		out[i] = float32(v.(float64))
	}
	return out
}

// ------------------ HANDLERS ------------------

func handleSearch(c *gin.Context) {
	q := c.Query("q")
	if q == "" || dbpool == nil {
		c.JSON(400, gin.H{"error": "bad request"})
		return
	}

	vec, err := getEmbedding(q)
	if err != nil {
		c.JSON(500, gin.H{"error": "embedding failed"})
		return
	}

	pgVec := vectorToPG(normalize(vec))

	rows, err := dbpool.Query(context.Background(),
		"SELECT id_custom, message, source, severity, metadata, similarity FROM match_incidents($1::vector, $2::float8, 50)",
		pgVec, 0.5,
	)
	if err != nil {
		log.Println("Search error:", err)
		c.JSON(500, gin.H{"error": "search failed"})
		return
	}
	defer rows.Close()

	results := []SearchResult{}
	seenMessages := make(map[string]bool)

	for rows.Next() {
		var r SearchResult
		var metadata map[string]interface{}

		if err := rows.Scan(&r.ID, &r.Message, &r.Service, &r.Severity, &metadata, &r.Similarity); err != nil {
			continue
		}

		if seenMessages[r.Message] {
			continue
		}

		if metadata != nil {
			if val, ok := metadata["value"].(float64); ok {
				r.Value = val
			}
		}

		results = append(results, r)
		seenMessages[r.Message] = true
		if len(results) >= 10 {
			break
		}
	}
	c.JSON(200, results)
}

func saveToDBDirect(inc Incident) {
	if dbpool == nil {
		return
	}
	metaObj := map[string]interface{}{"value": inc.Value}
	metaJSON, _ := json.Marshal(metaObj)

	query := `INSERT INTO incidents (source, severity, message, metadata, id_custom) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`
	_, err := dbpool.Exec(context.Background(), query, inc.Service, inc.Severity, inc.Message, metaJSON, inc.ID)
	if err != nil {
		log.Println("DB Insert Error:", err)
	}
}

func startAIWorker() {
	for inc := range aiQueue {
		vec, err := getEmbedding(inc.Message)
		if err != nil || dbpool == nil {
			continue
		}
		pgVec := vectorToPG(normalize(vec))
		_, _ = dbpool.Exec(context.Background(), `UPDATE incidents SET embedding=$1 WHERE id_custom=$2`, pgVec, inc.ID)
	}
}

func startEventStream() {
	t := time.NewTicker(tickInterval)
	for range t.C {
		batch := make([]Incident, 5)
		for i := 0; i < 5; i++ {
			inc := Incident{
				ID:        uuid.New().String(),
				Service:   []string{"auth-service", "payment-gateway", "order-engine"}[rand.Intn(3)],
				Severity:  []string{"LOW", "MEDIUM", "HIGH", "CRITICAL"}[rand.Intn(4)],
				Value:     rand.Float64() * 100,
				Timestamp: time.Now().UnixMilli(),
				Message:   []string{"DB timeout", "payment failure", "auth error", "cache spike", "order delay"}[rand.Intn(5)],
			}
			batch[i] = inc

			if inc.Severity == "HIGH" || inc.Severity == "CRITICAL" {
				saveToDBDirect(inc)
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

func main() {
	_ = godotenv.Load()
	config, _ := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	dbpool, _ = pgxpool.NewWithConfig(context.Background(), config)

	r := gin.Default()
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/ws", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		clientsMu.Lock()
		clients[conn] = true
		clientsMu.Unlock()
		defer func() {
			clientsMu.Lock()
			delete(clients, conn)
			clientsMu.Unlock()
			conn.Close()
		}()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	})

	r.GET("/api/search", handleSearch)
	go startAIWorker()
	go startEventStream()
	r.Run(":8080")
}
