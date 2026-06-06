# SMS Gateway Integration Plan (Thakur Dental Clinic)

This document provides the blueprint for replacing the development SMS mock logger with a live SMS gateway integration (e.g., Msg91, Textlocal, or Twilio) for sending password recovery links to patient and staff phone numbers.

---

## 1. Provider Recommendations & Compliance (India)

### A. Regulatory Requirements (TRAI & DLT)
In India, the Telecom Regulatory Authority of India (TRAI) mandates Distributed Ledger Technology (DLT) registration for all commercial or transactional messages.
1. **Entity Registration**: Register the clinic as a Principal Entity on a DLT platform (e.g., Jio, Airtel, Vodafone Idea, Videocon).
2. **Sender ID (Header)**: Register a 6-character alphabetic header representing the clinic (e.g., `THKRCL`).
3. **Template Registration**: Register the exact transactional message content template.
   - **Approved Template Text**: `Hello! Use this link to reset your Thakur Dental Clinic password: {#var#}. This link expires in 15 minutes.`
   - Note: The variable `{#var#}` will dynamically receive the recovery URL.

### B. Gateway Recommendations
- **Msg91**: Highly recommended for Indian transactional traffic. Excellent API, low latency, and direct support for DLT template IDs.
- **Textlocal**: Another reliable gateway in India with robust DLT support.
- **Twilio**: Ideal for international coverage and quick prototyping, but requires a pre-verified SMS number and is subject to local routing regulations in India.

---

## 2. Environment Configurations

Add these placeholder variables to your `backend/.env` file to easily switch providers and supply credentials:

```env
# SMS Gateway Configuration
SMS_PROVIDER=mock                     # Options: mock, twilio, msg91, textlocal
SMS_PROVIDER_API_KEY=your-api-key
SMS_PROVIDER_SENDER_ID=THKRCL         # Approved DLT header
SMS_TEMPLATE_ID=your-dlt-template-id   # Required for Indian gateways

# Twilio Specific Configurations (if SMS_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

---

## 3. Code Integration Blueprint

To cleanly swap out the console log mock in `services/auth_service.go`, implement the following interface structure:

### Step 1: Define the Sender Interface
Create a new file `backend/internal/utils/sms.go`:
```go
package utils

type SMSSender interface {
	SendSMS(to string, message string) error
}
```

### Step 2: Implement Provider Clients
Inside the same folder, implement client structs for Twilio or Msg91:

#### Twilio Client Implementation
```go
package utils

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type TwilioClient struct {
	AccountSID string
	AuthToken  string
	FromNumber string
}

func (c *TwilioClient) SendSMS(to string, message string) error {
	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", c.AccountSID)
	data := url.Values{}
	data.Set("To", to)
	data.Set("From", c.FromNumber)
	data.Set("Body", message)

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.AccountSID, c.AuthToken)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("twilio rejected request with status code: %d", resp.StatusCode)
	}
	return nil
}
```

#### Msg91 Client Implementation (DLT Template Compliant)
```go
package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type Msg91Client struct {
	AuthKey    string
	SenderID   string
	TemplateID string
}

type Msg91Payload struct {
	TemplateID string `json:"template_id"`
	Sender     string `json:"sender"`
	ShortURL   string `json:"short_url"` // "1" to enable, "0" to disable
	Recipients []struct {
		Mobilenumber string            `json:"mobilenumber"`
		Var          string            `json:"var"` // Matches DLT {#var#}
	} `json:"recipients"`
}

func (c *Msg91Client) SendSMS(to string, link string) error {
	apiURL := "https://api.msg91.com/api/v5/flow/"
	
	payload := Msg91Payload{
		TemplateID: c.TemplateID,
		Sender:     c.SenderID,
		ShortURL:   "0",
	}
	payload.Recipients = append(payload.Recipients, struct {
		Mobilenumber string            `json:"mobilenumber"`
		Var          string            `json:"var"`
	}{
		Mobilenumber: to,
		Var:          link,
	})

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Add("authkey", c.AuthKey)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("msg91 API error code: %d", resp.StatusCode)
	}
	return nil
}
```

### Step 3: Wire into `AuthService`
Update `AuthService` in `backend/internal/services/auth_service.go` to hold an instance of `SMSSender`:
```go
type AuthService struct {
	cfg        *config.Config
	userRepo   *repository.UserRepository
	smsSender  utils.SMSSender
}
```
Initialize the appropriate client in your database wiring or server setup, and call `s.smsSender.SendSMS(phone, resetLink)` in `sendResetSMS`.
