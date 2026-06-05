package handlers

import (
	"io"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
)

var (
	clients = make(map[string][]chan string)
	mu      sync.Mutex
)

// SendNotification pushes a real-time message payload to all active SSE streams of a specific user.
func SendNotification(userID string, payload string) {
	mu.Lock()
	defer mu.Unlock()
	chans, exists := clients[userID]
	if !exists {
		return
	}
	for _, ch := range chans {
		select {
		case ch <- payload:
		default:
			// Avoid blocking if channel is full
		}
	}
}

// StreamHandler exposes SSE endpoint for active authenticated users
func StreamHandler(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userIDStr := ""
	switch v := userIDVal.(type) {
	case string:
		userIDStr = v
	default:
		userIDStr = v.(interface{ String() string }).String()
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")

	messageChan := make(chan string, 10)

	// Register channel
	mu.Lock()
	clients[userIDStr] = append(clients[userIDStr], messageChan)
	mu.Unlock()

	// Unregister channel on exit
	defer func() {
		mu.Lock()
		chans := clients[userIDStr]
		for i, ch := range chans {
			if ch == messageChan {
				clients[userIDStr] = append(chans[:i], chans[i+1:]...)
				break
			}
		}
		if len(clients[userIDStr]) == 0 {
			delete(clients, userIDStr)
		}
		mu.Unlock()
	}()

	// Send an initial heartbeat or connect event
	c.SSEvent("message", "connected")
	c.Writer.Flush()

	c.Stream(func(w io.Writer) bool {
		if msg, ok := <-messageChan; ok {
			c.SSEvent("message", msg)
			return true
		}
		return false
	})
}
