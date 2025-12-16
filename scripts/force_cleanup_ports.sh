#!/bin/bash

echo "Starting port cleanup..."

# Function to kill process on port
kill_port() {
    PORT=$1
    echo "Checking port $PORT..."
    PID=$(lsof -t -i:$PORT)
    if [ ! -z "$PID" ]; then
        echo "Found process $PID on port $PORT. Killing..."
        sudo kill -9 $PID
        echo "Port $PORT cleared."
    else
        echo "Port $PORT is already free."
    fi
}

# Kill processes
kill_port 8070
kill_port 8601

echo "Flushing PM2 logs..."
pm2 flush

echo "Reloading PM2..."
pm2 reload all

echo "Done! Checking status..."
pm2 status
