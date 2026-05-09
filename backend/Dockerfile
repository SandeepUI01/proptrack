# Step 1: Build the Go binary
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Build the app from cmd/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -o /incident-app ./cmd/main.go

# Step 2: Create a tiny image to run it
FROM alpine:latest
WORKDIR /
COPY --from=builder /incident-app /incident-app
EXPOSE 8080
CMD ["/incident-app"]