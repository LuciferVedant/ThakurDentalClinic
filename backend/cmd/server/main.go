package main

import (
	"log"
	"net/http"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/cron"
	"thakur-dental-clinic/backend/internal/handlers"
	"thakur-dental-clinic/backend/internal/middleware"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"thakur-dental-clinic/backend/internal/services"
	"thakur-dental-clinic/backend/internal/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := utils.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&models.User{}, &models.OAuthAccount{}, &models.BlogPost{}, &models.ChatSession{}, &models.ChatMessage{}, &models.Appointment{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Start background appointment reminder worker
	cron.StartReminderWorker(db)

	// Seed Admin Doctor
	var adminUser models.User
	if err := db.Where("email = ?", "vedrocks2000@gmail.com").First(&adminUser).Error; err != nil {
		// Admin user doesn't exist, create it
		hashedPassword, _ := utils.HashPassword("admin123") // Default password, user should change it or login via Google
		adminUser = models.User{
			Email:        "vedrocks2000@gmail.com",
			PasswordHash: &hashedPassword,
			FirstName:    "Vedant",
			LastName:     "Khatri",
			UserType:     models.UserTypeDoctor,
			IsAdmin:      true,
			IsActive:     true,
		}
		if err := db.Create(&adminUser).Error; err != nil {
			log.Printf("Warning: Failed to seed admin user: %v", err)
		} else {
			log.Println("Successfully seeded admin doctor: Vedant Khatri")
		}
	} else {
		// Ensure it's always an admin doctor
		if !adminUser.IsAdmin || adminUser.UserType != models.UserTypeDoctor {
			adminUser.IsAdmin = true
			adminUser.UserType = models.UserTypeDoctor
			db.Save(&adminUser)
			log.Println("Updated existing user to be Admin Doctor")
		}
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	blogRepo := repository.NewBlogRepository(db)
	chatRepo := repository.NewChatRepository(db)
	appointmentRepo := repository.NewAppointmentRepository(db)

	// Initialize services
	authService := services.NewAuthService(userRepo, cfg)
	blogService := services.NewBlogService(blogRepo, userRepo)
	appointmentService := services.NewAppointmentService(appointmentRepo, userRepo)
	chatService, err := services.NewChatService(chatRepo)
	if err != nil {
		log.Printf("Warning: Failed to initialize ChatService (check GEMINI_API_KEY): %v", err)
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(userRepo, authService)
	blogHandler := handlers.NewBlogHandler(blogService)
	appointmentHandler := handlers.NewAppointmentHandler(appointmentService)
	uploadHandler := handlers.NewUploadHandler()
	var chatHandler *handlers.ChatHandler
	if chatService != nil {
		chatHandler = handlers.NewChatHandler(chatService)
	}

	// Wire notification handler callback
	services.NotifyFunc = handlers.SendNotification

	// Setup Gin router
	router := gin.Default()

	// Static files for uploads
	router.Static("/uploads", "./uploads")

	// CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Public routes
	api := router.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.GET("/google/url", authHandler.GetGoogleAuthURL)
			auth.GET("/google/callback", authHandler.GoogleCallback)
			auth.POST("/login", authHandler.Login)
			auth.POST("/signup", authHandler.RegisterPatient)
			auth.POST("/logout", authHandler.Logout)
		}

		// Public Blog Routes
		blogs := api.Group("/blogs")
		{
			blogs.GET("", blogHandler.GetAllBlogPosts)
			blogs.GET("/:id", blogHandler.GetBlogPost)
		}

		// Chat Routes
		chat := api.Group("/chat")
		if chatHandler != nil {
			chat.Use(middleware.OptionalAuthMiddleware(cfg))
			{
				chat.POST("", chatHandler.HandleChat)
				chat.GET("/history", middleware.AuthMiddleware(cfg), chatHandler.GetHistory)
				chat.DELETE("/history", middleware.AuthMiddleware(cfg), chatHandler.DeleteHistory)
				chat.GET("/session/:sessionId", middleware.AuthMiddleware(cfg), chatHandler.GetSessionMessages)
				chat.DELETE("/session/:sessionId", middleware.AuthMiddleware(cfg), chatHandler.DeleteSession)
			}
		} else {
			// Fallback routes to explain why chat is missing
			chat.Any("", func(c *gin.Context) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Chat service unavailable. Check server logs for initialization errors (likely missing GEMINI_API_KEY)."})
			})
			chat.Any("/*any", func(c *gin.Context) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Chat service unavailable. Check server logs for initialization errors (likely missing GEMINI_API_KEY)."})
			})
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(cfg))
		{
			protected.GET("/auth/me", authHandler.GetMe)
			protected.POST("/upload", uploadHandler.UploadFile)
			protected.POST("/upload/multiple", uploadHandler.UploadMultipleFiles)

			// SSE real-time notifications stream
			protected.GET("/auth/stream", handlers.StreamHandler)

			// Appointment Routes
			appointments := protected.Group("/appointments")
			{
				appointments.GET("", appointmentHandler.List)
				appointments.GET("/:id/prescription", func(c *gin.Context) {
					// TODO: Implement simple get if needed or just use GetAppointment
				})
				// Patients normally just View, but logic is in List

				// Doctor/Receptionist routes logic handled in handler or via simplified generic endpoints for now
				appointments.POST("", appointmentHandler.Create) // Admin/Doctor usually
				appointments.PUT("/:id/prescription", appointmentHandler.UploadPrescription)
				appointments.PUT("/:id/arrived", appointmentHandler.MarkArrived)
				appointments.PUT("/:id/start", appointmentHandler.StartConsultation)
				appointments.PUT("/:id/complete", appointmentHandler.Complete)

				// New Queue & Override Management Routes
				appointments.PUT("/:id/reassign", middleware.RequireAdmin(), appointmentHandler.Reassign)
				appointments.PUT("/:id/delay", middleware.RequireUserType(models.UserTypeDoctor, models.UserTypeReceptionist), appointmentHandler.Delay)
				appointments.PUT("/:id/accept-shift", appointmentHandler.AcceptShift)
			}

			// Protected User Routes (Self-update allowed)
			protected.PUT("/users/:id", userHandler.UpdateUser)

			// Admin-only routes
			admin := protected.Group("")
			admin.Use(middleware.RequireAdmin())
			{
				admin.POST("/users/staff", userHandler.CreateStaff)
				admin.GET("/users", userHandler.ListUsers)
				admin.GET("/users/:id", userHandler.GetUser)
				admin.PUT("/users/:id/deactivate", userHandler.DeactivateUser)

				// Admin Blog Routes
				admin.POST("/blogs", blogHandler.CreateBlogPost)
				admin.PUT("/blogs/:id", blogHandler.UpdateBlogPost)
				admin.DELETE("/blogs/:id", blogHandler.DeleteBlogPost)
			}
		}
	}

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy"})
	})

	// Start server
	log.Printf("Server starting on port %s", cfg.ServerPort)
	if err := router.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
