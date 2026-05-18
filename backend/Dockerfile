# Step 1: Build the Go binary
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .

# 🚀 CHANGED: Added production compression flags to strip debug bloating (-ldflags="-s -w")
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /incident-app ./cmd/main.go

# Step 2: Create a tiny image to run it
FROM alpine:3.21
# 🚀 CHANGED: Explicitly add SSL/TLS root certificates for your external cloud API calls
RUN apk --no-cache add ca-certificates

WORKDIR /
COPY --from=builder /incident-app /incident-app

# Keep this as documentation, but Railway will override this port via the PORT env variable
EXPOSE 8080

CMD ["/incident-app"]