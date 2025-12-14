#!/bin/bash

# Alternative script to create a user using direct SQL
# Requires bcrypt hash to be generated externally or uses a simple approach
# Usage: ./scripts/create-user-sql.sh <username> <password>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

# Generate bcrypt hash using Node.js
HASH=$(docker compose exec -T backend node -e "const bcrypt = require('bcrypt'); (async () => { const hash = await bcrypt.hash('$PASSWORD', 10); console.log(hash); })()")

# Insert user into database
docker compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-countfolks} -c "INSERT INTO users (username, password, \"createdAt\") VALUES ('$USERNAME', '$HASH', NOW()) ON CONFLICT (username) DO NOTHING;"

echo "User '$USERNAME' created successfully!"

