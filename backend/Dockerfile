FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install necessary build tools
RUN apk add --no-cache git gcc musl-dev

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies.
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# We disable CGO for a statically linked binary which runs better in alpine
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/server

# Start a new stage from scratch
FROM alpine:latest  

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/main .
# Copy the .env file
COPY --from=builder /app/.env .
# Copy the templates or other static assets if any (assuming they exist, though we might not need them if it's purely API)
# COPY --from=builder /app/templates ./templates

# Expose port 8080 to the outside world
EXPOSE 8080

# Command to run the executable
CMD ["./main"]
