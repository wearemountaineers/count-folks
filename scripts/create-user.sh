#!/bin/bash

# Script to create a user in the database
# Usage: ./scripts/create-user.sh <username> <password>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

echo "Creating user: $USERNAME"
# Use npx with -y flag to automatically install ts-node if needed
docker compose exec backend sh -c "npx -y ts-node src/auth/scripts/create-user.ts '$USERNAME' '$PASSWORD'"

