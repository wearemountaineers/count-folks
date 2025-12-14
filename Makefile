.PHONY: up down restart logs build clean

# Start all services
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Restart all services
restart:
	docker compose restart

# View logs
logs:
	docker compose logs -f

# View logs for specific service
logs-detector:
	docker compose logs -f detector

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

# Rebuild all services
build:
	docker compose build

# Rebuild and restart
rebuild:
	docker compose up -d --build

# Clean up (remove containers, volumes, networks)
clean:
	docker compose down -v

# Check service status
status:
	docker compose ps

# Access database
db-shell:
	docker compose exec postgres psql -U postgres -d countfolks

# Backup database
db-backup:
	docker compose exec postgres pg_dump -U postgres countfolks > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Test API
test-api:
	curl http://localhost:3000/counts?streamId=stream1

