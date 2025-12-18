# EduCodingNPlay Platform

## 📦 Docker Environment Setup (New)

This project has been containerized for security and consistency.
It uses **Judge0** for secure code execution and packs **Jupyter Notebook** within the application container.

### Prerequisites
- Docker & Docker Compose installed

### Quick Start
1. **Start Services**
   ```bash
   docker-compose up -d
   ```
   This will start:
   - `app` (Node.js + Jupyter): http://localhost:3000
   - `judge0` (Code Execution): http://localhost:2358
   - `db` (MySQL): Port 3306
   - `redis`: Port 6379

2. **Check Logs**
   ```bash
   docker-compose logs -f app
   ```

3. **Stop Services**
   ```bash
   docker-compose down
   ```

### Configuration
- Docker settings are in `docker-compose.yml`.
- Judge0 settings are in `judge0.conf`.
- Application environment variables should be set in `.env` (or passed via docker-compose).

### Troubleshooting
- **Jupyter Not Starting**: Ensure port 3000 is open and no other service is blocking it.
- **Judge0 Connection**: The app connects to Judge0 via `http://judge0-server:2358`. Ensure both are on the `edu-network`.
