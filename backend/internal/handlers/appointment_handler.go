package handlers

import (
	"encoding/json"
	"net/http"
	"thakur-dental-clinic/backend/internal/middleware"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/services"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AppointmentHandler struct {
	appointmentService *services.AppointmentService
}

func NewAppointmentHandler(appointmentService *services.AppointmentService) *AppointmentHandler {
	return &AppointmentHandler{appointmentService: appointmentService}
}

type CreateAppointmentRequest struct {
	DoctorID uuid.UUID `json:"doctorId" binding:"required"`
	DateTime time.Time `json:"dateTime" binding:"required"`
	Notes    string    `json:"notes"`
}

func (h *AppointmentHandler) Create(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req CreateAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	appointment, err := h.appointmentService.CreateAppointment(userID, req.DoctorID, req.DateTime, req.Notes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"appointment": appointment})
}

func (h *AppointmentHandler) List(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	// Get user type from context
	userTypeStr, exists := c.Get("userType")
	if !exists {
		// Fallback or error. For now default to patient if missing (shouldn't happen with middleware)
		userTypeStr = string(models.UserTypePatient)
	}
	userType := models.UserType(userTypeStr.(string))

	appointments, err := h.appointmentService.ListUserAppointments(userID, userType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch appointments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointments": appointments})
}

type UpdatePrescriptionRequest struct {
	PrescriptionURLs []string `json:"prescriptionUrls" binding:"required"`
}

func (h *AppointmentHandler) UploadPrescription(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment ID"})
		return
	}

	var req UpdatePrescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Marshaling array to JSON string for storage
	urlsJson, err := json.Marshal(req.PrescriptionURLs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process prescription URLs"})
		return
	}

	appointment, err := h.appointmentService.UpdatePrescription(id, string(urlsJson))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update prescription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointment": appointment})
}

func (h *AppointmentHandler) MarkArrived(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment ID"})
		return
	}

	appointment, err := h.appointmentService.MarkArrived(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark as arrived"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointment": appointment})
}

func (h *AppointmentHandler) StartConsultation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment ID"})
		return
	}

	appointment, err := h.appointmentService.StartConsultation(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start consultation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointment": appointment})
}

func (h *AppointmentHandler) Complete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment ID"})
		return
	}

	var input struct {
		PrescriptionURLs string `json:"prescriptionUrls"`
		PrescriptionType string `json:"prescriptionType"`
		PaymentMethod    string `json:"paymentMethod"`
		Notes            string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	appointment, err := h.appointmentService.CompleteAppointment(id, input.PrescriptionURLs, input.PrescriptionType, input.PaymentMethod, input.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete appointment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointment": appointment})
}

type ReassignDoctorRequest struct {
	DoctorID uuid.UUID `json:"doctorId" binding:"required"`
}

func (h *AppointmentHandler) Reassign(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment ID"})
		return
	}

	var req ReassignDoctorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	appointment, err := h.appointmentService.ReassignDoctor(id, req.DoctorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointment": appointment})
}

type DelayAppointmentRequest struct {
	DelayMinutes int `json:"delayMinutes"`
}

func (h *AppointmentHandler) Delay(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment ID"})
		return
	}

	var req DelayAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	appointment, err := h.appointmentService.DelayAppointment(id, req.DelayMinutes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointment": appointment})
}

func (h *AppointmentHandler) AcceptShift(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid appointment ID"})
		return
	}

	appointment, err := h.appointmentService.AcceptShift(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"appointment": appointment})
}

