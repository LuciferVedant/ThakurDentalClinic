# Thakur Dental Clinic - Management System

A comprehensive full-stack dental clinic management system with role-based access control, Google OAuth integration, and a modern responsive UI.

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Redux Toolkit** for state management
- **Vite** for build tooling
- **React Router** for navigation
- **TailwindCSS** for styling
- **Google OAuth 2.0** for patient authentication
- **Axios** for API calls

### Backend
- **Go 1.21+**
- **Gin** web framework
- **GORM** ORM
- **PostgreSQL 15+** database
- **JWT** for session management
- **Google OAuth 2.0** integration

## Features

### User Types
1. **Patients**
   - Self-registration via Google OAuth
   - View appointments and medical history
   - Book appointments

2. **Doctors**
   - View and manage patient appointments
   - Access patient records
   - **Admin Doctors**: Can create doctor and receptionist accounts

3. **Receptionists**
   - Manage appointment scheduling
   - Patient check-in
   - View daily schedules

### Authentication
- **Patients**: Google OAuth sign-in/sign-up
- **Staff (Doctors & Receptionists)**: Email/password credentials provided by Admin Doctors
- **JWT-based** session management
- Role-based access control (RBAC)

## Prerequisites

- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **PostgreSQL** 15 or higher
- **Docker** (optional, for PostgreSQL)
- **Google OAuth 2.0 Credentials**

## Setup Instructions

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials (OAuth client ID)
5. Add authorized redirect URIs:
   - `http://localhost:5173/auth/google/callback` (for frontend)
6. Copy the Client ID and Client Secret

### 2. Database Setup

#### Option A: Using Docker (Recommended)
```bash
# Start PostgreSQL container
docker-compose up -d

# Verify database is running
docker ps
```

#### Option B: Local PostgreSQL
```bash
# Create database
psql -U postgres
CREATE DATABASE thakur_dental_clinic;
\q
```

### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Copy environment file
cp .env.example .env

# Edit .env and add your Google OAuth credentials
# Required variables:
# - GOOGLE_CLIENT_ID=your-client-id
# - GOOGLE_CLIENT_SECRET=your-client-secret
# - JWT_SECRET=your-secure-secret-key

# Install dependencies
go mod tidy

# Run database migrations (GORM auto-migrates on startup)
# Or manually run migrations:
# psql -U postgres -d thakur_dental_clinic -f migrations/001_initial_schema.sql

# Start the server
go run cmd/server/main.go
```

The backend server will start on `http://localhost:8080`

### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your Google OAuth Client ID
# VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5173`

## Default Admin Account

After the database migration, a default admin doctor account is created:

**Email**: `admin@thakurdental.com`  
**Password**: `Admin@123` (You should change this immediately)

> **Note**: The default password hash needs to be generated. Run this to create the hash:
```bash
cd backend
go run -c 'package main; import "golang.org/x/crypto/bcrypt"; import "fmt"; hash, _ := bcrypt.GenerateFromPassword([]byte("Admin@123"), bcrypt.DefaultCost); fmt.Println(string(hash))'
```

Then update the migration file with the generated hash.

## API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /api/auth/google/url` - Get Google OAuth URL
- `GET /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/login` - Email/password login

### Protected Endpoints
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout

### Admin-Only Endpoints
- `POST /api/users/staff` - Create doctor/receptionist account
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/deactivate` - Deactivate user

## Usage Guide

### For Admin Doctors

1. **Login** with your admin credentials
2. Navigate to the **Admin Dashboard**
3. Click **"+ Add Staff"** to create new doctor or receptionist accounts
4. Fill in the staff member's details
5. Click **"Generate"** to auto-generate a secure password
6. **Copy the credentials** and share them securely with the staff member
7. The staff member can login using these credentials

### For Staff Members (Doctors & Receptionists)

1. Receive your credentials from an Admin Doctor
2. Go to the login page
3. Use the **"For Staff Members"** email/password form
4. Enter your email and password
5. Access your dashboard based on your role

### For Patients

1. Go to the login page
2. Click **"Sign in with Google"**
3. Authorize the application
4. Access your patient dashboard
5. Book appointments and view your medical history

## Project Structure

```
thakur-dental-clinic/
├── backend/
│   ├── cmd/server/          # Application entry point
│   ├── internal/
│   │   ├── config/          # Configuration management
│   │   ├── handlers/        # HTTP request handlers
│   │   ├── middleware/      # Authentication middleware
│   │   ├── models/          # Database models
│   │   ├── repository/      # Data access layer
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utility functions
│   ├── migrations/          # Database migrations
│   ├── go.mod
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── store/           # Redux store and slices
│   │   ├── utils/           # Utility functions
│   │   ├── App.tsx          # Main App component
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   └── .env
├── docker-compose.yml       # PostgreSQL setup
└── README.md
```

## Development

### Backend Development
```bash
cd backend
go run cmd/server/main.go
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Building for Production

#### Backend
```bash
cd backend
go build -o server cmd/server/main.go
./server
```

#### Frontend
```bash
cd frontend
npm run build
npm run preview  # Preview production build
```

## Security Considerations

1. **Change default admin password** immediately after setup
2. **Use strong JWT secret** in production
3. **Use HTTPS** in production
4. **Configure CORS** properly for your domain
5. **Store Google OAuth secrets** securely
6. **Enable PostgreSQL SSL** in production
7. **Use environment variables** for all secrets
8. **Implement rate limiting** for API endpoints
9. **Regular security audits** and updates

## Troubleshooting

### Backend Issues

**Database connection failed**
- Check PostgreSQL is running: `docker ps` or `systemctl status postgresql`
- Verify credentials in `.env`
- Ensure database exists

**Google OAuth errors**
- Verify Client ID and Secret in `.env`
- Check redirect URIs in Google Cloud Console
- Ensure Google+ API is enabled

### Frontend Issues

**Google Sign-In not working**
- Check `VITE_GOOGLE_CLIENT_ID` in `.env`
- Verify the Client ID matches Google Cloud Console
- Check browser console for errors

**API connection errors**
- Verify backend is running on port 8080
- Check `VITE_API_URL` in frontend `.env`
- Inspect browser network tab for failed requests

## Future Enhancements

- Appointment booking system
- Patient medical records
- Prescription management
- Billing and invoicing
- SMS/Email notifications
- Reports and analytics
- Multi-clinic support
- Mobile applications

## License

This project is proprietary software for Thakur Dental Clinic.

## Support

For support and questions, please contact the development team.
