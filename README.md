# Count Folks - People Counting System

A containerized solution for real-time people counting from video streams, with a NestJS backend API and React frontend dashboard.

## Architecture

The system consists of four main services:

- **Detector**: Python service using YOLOv8 to detect and count people in video streams
- **Backend**: NestJS REST API for storing and querying count data
- **Database**: PostgreSQL for persistent storage
- **Frontend**: React dashboard for visualizing count data

## Prerequisites

- Docker and Docker Compose V2 installed (plugin-based, not the old Python version)
- Ubuntu Server (or any Linux distribution with Docker support)
- At least 4GB RAM recommended
- Network access to video stream URL

## Quick Start

1. **Clone the repository** (if applicable) or navigate to the project directory

2. **Create environment file** (optional, defaults are provided):
   ```bash
   # Create .env file with your settings (see Configuration section below)
   # Or use the default values in docker-compose.yml
   ```

3. **Start all services**:
   ```bash
   docker compose up -d
   ```
   
   **Note:** Use `docker compose` (with space, V2) not `docker-compose` (with hyphen, V1). If you get a `ModuleNotFoundError: No module named 'distutils'` error, see the Troubleshooting section below.

4. **Access the frontend**:
   Open your browser and navigate to `http://localhost`

5. **Access the backend API**:
   API is available at `http://localhost:3000`

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=countfolks

# Stream Configuration
STREAM_URL=https://wintereventsonenbreugel.s3.eu-west-1.amazonaws.com/hls/0/stream.m3u8
STREAM_ID=stream1

# Detector Configuration
CONFIDENCE_THRESHOLD=0.35
AGGREGATION_INTERVAL=15
```

### Stream URL

The detector supports HLS streams (`.m3u8` files) and RTSP streams. Update `STREAM_URL` in your `.env` file or `docker-compose.yml`.

## API Endpoints

### POST /counts
Create a new count entry (used by detector service).

**Request Body:**
```json
{
  "streamId": "stream1",
  "windowStart": "2024-01-01T00:00:00Z",
  "windowEnd": "2024-01-01T00:01:00Z",
  "avgCount": 5.5
}
```

### GET /counts
Query count data with optional filters.

**Query Parameters:**
- `streamId` (optional): Filter by stream ID
- `from` (optional): Start date/time (ISO 8601)
- `to` (optional): End date/time (ISO 8601)
- `aggregation` (optional): `hour` or `day` for aggregated results

**Example:**
```
GET /counts?streamId=stream1&from=2024-01-01T00:00:00Z&to=2024-01-01T23:59:59Z
```

## Services

### Detector Service

The detector service:
- Connects to the video stream
- Processes frames using YOLOv8n model
- Counts people with confidence threshold filtering
- Aggregates counts over 1-minute intervals
- Sends aggregated data to the backend API
- Automatically reconnects on stream failures

**Logs:**
```bash
docker-compose logs -f detector
```

### Backend Service

The NestJS backend:
- Receives count data from detector
- Stores data in PostgreSQL
- Provides REST API for querying counts
- Supports date range filtering and aggregation

**Logs:**
```bash
docker-compose logs -f backend
```

### Frontend Service

The React frontend:
- Displays people count data in charts
- Allows date selection for historical data
- Shows statistics (total, average, peak counts)
- Supports multiple stream IDs

## Deployment on Ubuntu Server

1. **Install Docker and Docker Compose V2**:
   ```bash
   # Install Docker
   sudo apt update
   sudo apt install -y docker.io
   sudo systemctl enable docker
   sudo systemctl start docker
   
   # Install Docker Compose V2 (plugin-based)
   sudo apt install -y docker-compose-plugin
   
   # Add user to docker group
   sudo usermod -aG docker $USER
   # Log out and back in for group changes to take effect
   ```
   
   **Note:** Docker Compose V2 is installed as a Docker plugin. Use `docker compose` (with space) instead of `docker-compose` (with hyphen).

2. **Clone or copy the project** to your server

3. **Configure environment** (optional):
   ```bash
   # Create .env file with your settings (see Configuration section above)
   # Or use the default values in docker-compose.yml
   ```

4. **Start services**:
   ```bash
   docker compose up -d
   ```

5. **Check service status**:
   ```bash
   docker compose ps
   ```

6. **View logs**:
   ```bash
   docker compose logs -f
   ```

## Monitoring and Maintenance

### Check Service Health

```bash
# Check all services
docker compose ps

# Check specific service logs
docker compose logs -f detector
docker compose logs -f backend
docker compose logs -f frontend
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart detector
```

### Stop Services

```bash
docker compose down
```

### Update Services

```bash
# Rebuild and restart
docker compose up -d --build
```

### Database Backup

```bash
# Backup database
docker compose exec postgres pg_dump -U postgres countfolks > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres countfolks < backup.sql
```

## Troubleshooting

### Docker Compose Error: "ModuleNotFoundError: No module named 'distutils'"

**Problem:** You're using the old Python-based `docker-compose` (v1) which is incompatible with Python 3.12+.

**Solution:** Use Docker Compose V2 (plugin-based) instead:

1. **Remove old docker-compose (if installed):**
   ```bash
   sudo apt remove docker-compose
   ```

2. **Install Docker Compose V2:**
   ```bash
   sudo apt update
   sudo apt install -y docker-compose-plugin
   ```

3. **Use the new command syntax:**
   - Old: `docker-compose up -d` (with hyphen)
   - New: `docker compose up -d` (with space)

4. **Verify installation:**
   ```bash
   docker compose version
   ```
   Should show: `Docker Compose version v2.x.x`

**Alternative:** If you must use the old version, install distutils:
   ```bash
   sudo apt install -y python3-distutils
   ```
   But we strongly recommend using Docker Compose V2 instead.

### Build Error: "No space left on device"

**Problem:** The Docker build is running out of disk space, especially when installing PyTorch with CUDA dependencies (~2GB+).

**Solutions:**

1. **Check available disk space:**
   ```bash
   df -h
   ```

2. **Clean up Docker to free space:**
   ```bash
   # Remove unused Docker data
   docker system prune -a --volumes
   
   # Check Docker disk usage
   docker system df
   ```

3. **The detector uses CPU-only PyTorch** (much smaller, ~200MB). If you still run out of space:
   ```bash
   # Free up system space
   sudo apt clean
   sudo apt autoremove
   
   # Check what's using space
   du -sh /var/lib/docker/*
   ```

4. **Minimum disk space required:** At least 5GB free for the initial build. After build, the system uses ~2-3GB.

5. **If you have a GPU and want CUDA support**, you'll need even more space. Edit `detector/Dockerfile` to remove the CPU-only PyTorch installation and use regular PyTorch (but this requires ~10GB+ free space).

### Detector not connecting to stream

1. Check stream URL is accessible:
   ```bash
   curl -I <STREAM_URL>
   ```

2. Check detector logs:
   ```bash
   docker compose logs detector
   ```

3. Verify FFmpeg is working in container:
   ```bash
   docker compose exec detector ffmpeg -version
   ```

### Backend not connecting to database

1. Check database is running:
   ```bash
   docker compose ps postgres
   ```

2. Check database logs:
   ```bash
   docker compose logs postgres
   ```

3. Verify connection from backend:
   ```bash
   docker compose exec backend sh
   # Then try connecting to postgres
   ```

### Frontend not loading

1. Check frontend is running:
   ```bash
   docker compose ps frontend
   ```

2. Check frontend logs:
   ```bash
   docker compose logs frontend
   ```

3. Verify API URL in frontend environment

## Development

### Running Locally (without Docker)

#### Detector
```bash
cd detector
pip install -r requirements.txt
python app.py
```

#### Backend
```bash
cd backend
npm install
npm run start:dev
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## Validation Steps

1. **Verify all services are running**:
   ```bash
   docker compose ps
   ```
   All services should show "Up" status.

2. **Check detector is processing frames**:
   ```bash
   docker compose logs detector | grep "Processed"
   ```

3. **Verify backend is receiving data**:
   ```bash
   docker compose logs backend | grep "POST /counts"
   ```

4. **Test API endpoint**:
   ```bash
   curl http://localhost:3000/counts?streamId=stream1
   ```

5. **Access frontend**:
   Open `http://localhost` in browser and verify:
   - Date selector works
   - Chart displays data
   - Statistics are shown

6. **Verify data persistence**:
   - Wait for at least 1 minute
   - Check database:
     ```bash
     docker compose exec postgres psql -U postgres -d countfolks -c "SELECT COUNT(*) FROM counts;"
     ```

## Performance Considerations

- **CPU**: Detector service is CPU-intensive. Consider using GPU if available.
- **Memory**: Each service requires ~500MB-1GB RAM.
- **Network**: Ensure stable connection to video stream.
- **Storage**: Database will grow over time. Monitor disk usage.

## Security Notes

- Change default database passwords in production
- Use environment variables for sensitive data
- Consider adding authentication to API endpoints
- Use HTTPS in production for frontend/backend
- Restrict network access to services

## License

MIT

