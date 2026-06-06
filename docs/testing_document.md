# Thakur Dental Clinic: Integration Test Documentation

This document serves as the master guide for the clinic's test suite, verifying all queue timing, overrides, notifications, and scheduler features.

---

## 1. Test Architecture & Database Isolation
To test actual database behaviors (such as PostgreSQL timezone math and custom SQL interval queries like `CURRENT_DATE + INTERVAL '1 day'`) without polluting production data:
*   **Transaction Isolation**: The test suite uses a transaction-wrapped database connection.
*   **Auto Rollback**: The helper function `SetupTestDB(t)` boots a `db.Begin()` transaction. A deferred `tx.Rollback()` at the end of each test completely cleanses all records, leaving the developer database untouched.
*   **SSE Notification Stubbing**: The backend SSE alert notifier is stubbed (`services.NotifyFunc = func(...)`) to capture and assert real-time SSE payloads, confirming that patients receive notifications with correct payloads.

---

## 2. Test Scenarios (Minute-by-Minute Breakdown)

### **Scenario 1: Happy Path Lifecycle**
*   **Functionality Tested**: Verification of booking, check-in, room consultation, payment entry, diagnosis notes saving, and clinical completion.
*   **Minute-by-Minute Timeline**:
    1.  **Minute 0 (Booking)**: Patient registers and books their slot for today.
        *   *Validation*: System generates Queue Token `#1`. Appointment status defaults to `scheduled`. `ShiftAccepted` is set to `true`.
        *   *Constraint Validation*: Patient attempts to schedule another booking for today; the system blocks the request, enforcing the daily booking limit.
    2.  **Minute 30 (Check-In)**: Patient checks in at the reception desk.
        *   *Validation*: Receptionist marks the patient as `arrived`. Status transitions to `arrived`.
    3.  **Minute 35 (Consultation Start)**: Patient is called to the doctor's room.
        *   *Validation*: Receptionist clicks "Start Consultation". Status transitions to `in-consultation` and the `ActualStartTime` timestamp is set to the current system time.
    4.  **Minute 60 (Completion)**: Consultation concludes.
        *   *Validation*: Doctor inputs digital prescription notes (`"Take medications twice daily"`) or uploads manual prescription files (`/uploads/prescription1.jpg`), selects `cash` payment, and clicks "Complete Visit".
        *   *Result*: Status transitions to `completed`. Payment status flags `paid`. `Notes` or prescription URLs are written to the database. `ActualEndTime` timestamp is logged.

---

### **Scenario 1.5: Booking Validation Errors**
*   **Functionality Tested**: Exclusions, validation errors, and doctor/patient availability checks.
*   **Use Cases Verified**:
    1.  **Doctor On Leave**: When a patient attempts to book an appointment with a doctor who is flagged as `IsOnLeave = true`, the system returns the error: `"doctor is currently on leave"`.
    2.  **Invalid Staff Role**: When booking with a user who is a receptionist instead of a doctor, the system returns the error: `"selected user is not a doctor"`.
    3.  **Non-existent Doctor**: Booking with a non-existent doctor ID returns the error: `"doctor not found"`.
    4.  **Non-existent Patient**: Booking with a non-existent patient ID returns the error: `"patient not found"`.
    5.  **Inactive Doctor**: Booking with a deactivated doctor returns the error: `"doctor is currently inactive"`.
    6.  **Inactive Patient**: Booking with a deactivated patient returns the error: `"patient account is inactive"`.

---

### **Scenario 2: Over-Consultation Queue Shifting & Real-Time Alerts**
*   **Functionality Tested**: Dynamic queue delays, subsequent estimated arrival pushes, acceptance resets, and live patient notifications.
*   **Minute-by-Minute Timeline**:
    1.  **Minute 0**: Patients 1, 2, and 3 schedule appointments for the same doctor.
        *   *Validation*: System issues Tokens `#1`, `#2`, and `#3`. Patient 2's starting time is calculated at `Patient 1's Start + 35 minutes`. Patient 3's time is set to `Patient 1's Start + 70 minutes`.
    2.  **Minute 10**: Patient 1 enters the consulting room (`status = in-consultation`).
    3.  **Minute 60 (Overrun)**: Patient 1's consultation concludes. The session took **50 minutes** (exceeding the standard 35-minute slot by **15 minutes**).
    4.  **Minute 60 (Propagation)**: Doctor completes the consultation.
        *   *Validation*: Complete handler calculates the 15-minute overrun and propagates a queue shift.
        *   *Result*: Patient 2's estimated start time shifts forward by 15 minutes. Patient 3's time shifts by 15 minutes.
        *   *State Update*: Patient 2 and Patient 3's `ShiftAccepted` flags reset to `false`.
        *   *SSE Broadcast*: System pushes 2 JSON payloads to the SSE streamer:
            - **To Patient 2**: `"type": "QUEUE_SHIFT", "delayMinutes": 15, "message": "shifted by 15 minutes"`
            - **To Patient 3**: `"type": "QUEUE_SHIFT", "delayMinutes": 15, "message": "shifted by 15 minutes"`

---

### **Scenario 3: Receptionist Manual Timing Overrides**
*   **Functionality Tested**: Manual delay overrides by receptionist/doctor, queue shifting propagation, and patient acceptance.
*   **Minute-by-Minute Timeline**:
    1.  **Minute 0**: Patient books slot `#1` starting in 60 minutes.
    2.  **Minute 15**: Receptionist receives a call from the patient asking for a slight delay.
    3.  **Minute 15 (Manual Override)**: Receptionist clicks `+20m` on the dashboard.
        *   *Validation*: Backend executes `DelayAppointment(appID, 20)`. The estimated start time increments by 20 minutes and `ShiftAccepted` becomes `false`.
        *   *SSE Alert*: Patient dashboard receives a `QUEUE_SHIFT` notification with the adjusted time.
    4.  **Minute 20 (Patient Acceptance)**: Patient views the delay warning banner and clicks "Accept Shift".
        *   *Validation*: System updates the database setting `ShiftAccepted = true`.

---

### **Scenario 4: Doctor Reassignment Control**
*   **Functionality Tested**: Admin doctor reassignment overrides and patient alerts.
*   **Minute-by-Minute Timeline**:
    1.  **Minute 0**: Patient books an appointment. The default doctor is Dr. Ajay Thakur.
    2.  **Minute 10 (Override)**: Admin Doctor notices Dr. Thakur's queue is busy, selects the dropdown on the dashboard, and reassigns the patient to Dr. Vijay Sharma.
        *   *Validation*: System updates `DoctorID` to the new doctor's ID, clears old association cache, and saves.
        *   *SSE Alert*: Patient receives a `DOCTOR_REASSIGNED` message: `"Your doctor has been changed to Dr. Vijay Sharma."`

---

### **Scenario 5: Pre-Arrival Reminders**
*   **Functionality Tested**: Background check loops, upcoming slot matches (30-minute threshold), and auto-triggered notifications.
*   **Minute-by-Minute Timeline**:
    1.  **Minute 0**: Patient books an appointment starting in exactly 15 minutes (under the 30-minute reminder window). `ReminderSent` is set to `false`.
    2.  **Minute 2 (Ticker Trigger)**: The background cron worker executes `CheckReminders()`.
        *   *Validation*: Queries appointments starting within 30 minutes where `status = scheduled AND reminder_sent = false`.
        *   *State Update*: Database marks `ReminderSent = true`.
        *   *Stdout Log*: Printout logged to container console:
            `[DEMO REMINDER SENT] Patient: Rohan Kumar, Time: 12:30, Doctor: Dr. Ajay Thakur`
        *   *SSE Alert*: Dispatches `PRE_ARRIVAL_REMINDER` warning to the patient dashboard.

### **Scenario 6: Phone & Email Signup/Login Verification**
*   **Functionality Tested**: Patient registration and login options (email-only, phone-only, or both), staff registration validations, duplicate checks, and profile updating constraints.
*   **Use Cases Verified**:
    1.  **Patient Signup (Phone Only)**: Patient registers with a phone number and no email address. The system succeeds, assigning the identifier to the database.
    2.  **Patient Signup (Email Only)**: Patient registers with an email address and no phone number. The system succeeds.
    3.  **Patient Signup (Both)**: Patient registers with both an email and phone number. The system succeeds.
    4.  **Patient Signup (Neither)**: Registering with neither email nor phone is blocked by validation, returning: `"At least one of email or phone number is required"`.
    5.  **Staff Registration Constraints**: Creating a staff member with either email or phone missing is blocked by validation, enforcing both are required.
    6.  **Already Registered (Conflict Check)**: Registering with an email or phone number that already exists returns a conflict warning to the user, suggesting they log in instead.
    7.  **Profile Update Validation**:
        *   Patients can update their profile, but clearing both fields returns a bad request.
        *   Staff members attempting to clear either their email or phone number in profile update are blocked.

---

## 3. How to Run the Automated Tests

To run the integration tests locally on the host machine (connects to the running Postgres container port):
```bash
cd backend
go test -v ./internal/services
```

---

## 4. UI Manual Testing Guide (End-to-End Flow)

Follow these instructions to verify the entire scheduling, check-in, dynamic shifting, and completion lifecycle directly from the user interface.

### **Preparation**
1.  Ensure all containers are running: `docker compose up -d`.
2.  Open your browser and navigate to the frontend: `http://localhost:5173`.
3.  Open an **incognito browser session** (or use two different browsers like Chrome and Safari) so you can log in as a **Patient** and **Staff member** concurrently.

---

### **Step 1: Patient Booking**
1.  In Browser A, go to the Sign-Up tab and register a new patient (with first name, optional middle name, last name, email, and phone). Alternatively, log in via Google OAuth.
2.  On the Patient Dashboard, scroll to the booking section.
3.  Choose an appointment time and notes, and click **"Schedule Appointment"**.
4.  *Verification*:
    - The booking is successfully created and displays a prominent blue **Token Badge** (e.g., `#1`).
    - The **Estimated Start Time** is dynamically calculated and displayed.
    - Try to schedule a second appointment for today; the booking card will block the action, enforcing the daily limit check.

---

### **Step 2: Pre-Arrival Courtesy Calling (Receptionist)**
1.  In Browser B, log in as receptionist or staff. (You can use the seeded Admin Doctor account: Email `vedrocks2000@gmail.com` / Password `admin123`).
2.  Navigate to the **Pre-Arrival Call List** tab.
3.  *Verification*:
    - If the patient's appointment starts within the next 45 minutes, they will appear in this tab showing their name, scheduled slot, and phone number.
    - Click **"Mark Called"** next to the patient.
    - *Result*: The button changes immediately to a green **"Called"** checkmark log.

---

### **Step 3: Checking In & Consulting (Receptionist)**
1.  In Browser B (staff session), switch back to the **Appointments Queue** tab.
2.  Locate the patient's token card in the queue.
3.  Click **"Mark Arrived"**.
    - *Result*: The card status changes to `arrived`.
4.  Click **"Start Consult"**.
    - *Result*: The status shifts to `in-consultation`.
    - *Real-time SSE Verification*: Switch to Browser A (patient session). Verify that a green check-in toast notification automatically slides in, and the patient dashboard status updates instantly to `in-consultation` without manual page reloads.

---

### **Step 4: Clinical Completion & Bookkeeping (Doctor)**
1.  If logged in as the doctor, look at the active queue row for the patient in consultation.
2.  Click **"Write Prescription"**.
3.  In the Completion Modal:
    - Input digital prescription notes (e.g. `"Brush teeth twice daily, recommend floss"`) or upload a prescription file.
    - Select a payment method (e.g., `Cash` or `Online`).
    - Click **"Complete Visit & Generate Bill"**.
4.  *Verification*:
    - The appointment status shifts to `completed`.
    - Switch to Browser A (patient session). Access the **Appointment History** card. The completed appointment appears with a **"View Records"** button. Click it.
    - *Visit Records View*:
      - Verify that the typed digital prescription notes are rendered beautifully under the **"Doctor's Diagnosis & Notes"** card.
      - Verify that the **"Invoice & Receipt Summary"** card is rendered, displaying:
        - **Receipt Reference ID**: `REC-[AppointmentID]`
        - **Consultation Fee**: ₹500.00
        - **Payment Status**: Paid (with a green badge)
        - **Payment Method**: Cash or Online (UPI/Card)
        - **Transaction Timestamp**: The exact completion date and time.
      - Click **"Print Receipt"** and verify that the print dialog triggers successfully.

---

### **Step 5: Verifying Dynamic timing Overrides & Queue Pushes**
To test queue timing updates and live SSE warnings:
1.  **Doctor Reassignments**:
    - Log in as the Admin Doctor in Browser B.
    - On an upcoming patient token card, click the **"Assign"** dropdown menu and select a different active doctor.
    - *SSE Verification*: The patient session in Browser A immediately pops up an indigo notification toast stating: *"Your doctor has been changed to Dr. [Name]."*
2.  **Manual timing Delays**:
    - In the staff session, locate an upcoming scheduled patient token card.
    - Click the **"+15m"** or **"+30m"** delay button under the card's actions.
    - *Result*: The estimated start time for the patient and all subsequent patients in today's queue increases by the delay amount.
    - *SSE Verification*: The affected patient's dashboard instantly pops up a warning toast and displays an amber alert banner: *"Clinic delay detected. New estimated time is... [Accept Shift]"*. Click **"Accept Shift"** to confirm.
3.  **Staff Deactivation & Leave Exclusions**:
    - Log in as the Admin Doctor in Browser B. Go to the Admin Dashboard.
    - Select a doctor and toggle their leave switch to `On Leave` or update their status to `Deactivated`.
    - In Browser A (patient session), open the scheduling panel.
    - *Verification*: Confirm that the deactivated or on-leave doctor is filtered out of the "Select Doctor" dropdown.
4.  **Optional Middle Name UI Validation**:
    - Verify the signup form includes a "Middle Name (Opt)" field arranged in a 2x2 grid.
    - Register a patient with a middle name. Verify the dashboard header and top navbar show the middle name cleanly.
    - Go to the Profile page, remove the middle name, and save. Verify the name renders with a single space and no double-space formatting errors.

---

### **Step 6: Verifying Phone & Email Signup/Login and Profile Rules**
1.  **Patient Signup options**:
    - Navigate to the signup form in Browser A.
    - Attempt to sign up leaving both Email and Phone blank. Verify that inline validation errors block form submission and highlight the inputs in red.
    - Fill only the Phone number (leaving Email blank) and register. Verify that registration completes successfully and logs you in.
    - Log out, then try to sign up again with the exact same phone number. Verify that the backend returns a conflict error, which is displayed in the main alert box at the top of the form, advising you to log in.
2.  **Patient Login options**:
    - Go to the login tab in Browser A.
    - Log in using the phone number you registered in the previous step. Verify that login succeeds.
    - Open the edit profile screen, enter an email address, and click "Save Changes". Go back to view mode and verify it shows both email and phone.
    - Edit profile again, erase the phone number (keeping email) and save. Verify the update succeeds.
    - Erase both email and phone number in profile editing and save. Verify that a validation alert blocks the action.
3.  **Staff Validation (Admin)**:
    - Log in as the Admin Doctor in Browser B. Go to the Admin Dashboard.
    - Click **"+ Add Staff"**.
    - Fill in the staff creation form, but leave the phone field blank. Attempt to submit. Verify the browser/form blocks you, or the API rejects with a missing phone error.
    - Fill in the phone field but leave the email field blank. Verify it blocks submission.
    - Enter a valid email and phone number and submit. Verify that the credentials modal pops up showing the generated password.
    - Log in with the newly created staff member in Browser C (or an incognito tab) using either their email or phone number.
    - Once logged in, go to the Profile screen and click Edit Profile. Attempt to clear either the Email or Phone field and save. Verify the alert blocks the update, enforcing that both are required for staff.
