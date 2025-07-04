# LoanSight - Loan Management System

A comprehensive loan management platform that simplifies borrower tracking, payment monitoring, and financial risk assessment.

## Features

- **Borrower Management**: Track borrower information, guarantors, and loan details
- **Payment Tracking**: Monitor upcoming payments, mark as collected, handle dues
- **Defaulter Management**: Automatic detection of overdue and defaulter borrowers
- **Role-based Authentication**: Admin and viewer roles with different access levels
- **Comprehensive Reporting**: CSV exports for borrowers and defaulters
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Prerequisites

- Docker and Docker Compose installed on your machine
- Git (to clone the repository)

## Running Locally with Docker

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd loansight
```

### 2. Start the Application
```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### 3. Initialize the Database
Once the containers are running, initialize the database schema:
```bash
# Run database migrations
docker-compose exec app npm run db:push
```

### 4. Access the Application
- **Application**: http://localhost:5009
- **Database**: localhost:5432 (if you need direct access)

### 5. Default Login Credentials
Create your admin account on first login or use these test credentials:
- **Username**: admin
- **Password**: Admin@123

## Docker Services

The application runs with two services:

### Application Service
- **Port**: 5000
- **Environment**: Production mode
- **Auto-restart**: Yes

### Database Service
- **Type**: PostgreSQL 15
- **Port**: 5432
- **Database**: loansight
- **Username**: loansight
- **Password**: loansight123

## Development

For development without Docker:
```bash
# Install dependencies
npm install

# Set up environment variables
export DATABASE_URL="postgresql://loansight:loansight123@localhost:5432/loansight"

# Start development server
npm run dev
```

## Database Management

### Backup Data
```bash
# Create database backup
docker-compose exec db pg_dump -U loansight loansight > backup.sql
```

### Restore Data
```bash
# Restore from backup
docker-compose exec -T db psql -U loansight loansight < backup.sql
```

### Reset Database
```bash
# Stop services
docker-compose down

# Remove database volume
docker volume rm loansight_postgres_data

# Restart services
docker-compose up --build
```

## Environment Variables

Create a `.env` file to customize settings:
```env
# Database
DATABASE_URL=postgresql://loansight:loansight123@db:5432/loansight
PGHOST=db
PGPORT=5432
PGUSER=loansight
PGPASSWORD=loansight123
PGDATABASE=loansight

# Application
NODE_ENV=production
PORT=5000
```

## Troubleshooting

### Port Already in Use
If port 5000 or 5432 is already in use:
```bash
# Change ports in docker-compose.yml
# For app: "5001:5000"
# For db: "5433:5432"
```

### Database Connection Issues
```bash
# Check database health
docker-compose exec db pg_isready -U loansight

# View database logs
docker-compose logs db
```

### Application Logs
```bash
# View application logs
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app
```

## Loan Strategies

### EMI Loans
- Fixed monthly installments
- User-defined tenure and EMI amount
- Automatic payment schedule generation

### FLAT Loans
- Fixed monthly payments
- Flexible tenure (default 6 months)
- Bulk payment options (3, 6, 9, 12 months)

## Security Features

- Session-based authentication
- Role-based access control (Admin/Viewer)
- Secure delete confirmations
- Password protection for sensitive operations

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session management
- **Containerization**: Docker & Docker Compose

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker logs for error details
3. Ensure all prerequisites are installed correctly

---

**LoanSight** - Simple. Smart. Tracked.