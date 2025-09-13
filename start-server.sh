#!/bin/bash

echo "Starting Medical PDF Analyzer Server..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "server/package.json" ]; then
    echo "Error: server/package.json not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Navigate to server directory
cd server

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies"
        exit 1
    fi
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp config.example.env .env
    echo
    echo "IMPORTANT: Please edit .env file to configure your settings"
    echo "- Set OPENAI_API_KEY if using OpenAI"
    echo "- Set LLAMA_API_URL if using local Llama"
    echo "- Configure ALLOW_EXTERNAL_PHI_PROCESSING as needed"
    echo
    read -p "Press Enter to continue after configuring .env file..."
fi

# Start the server
echo "Starting server..."
echo "Server will be available at: http://localhost:3001"
echo
echo "Press Ctrl+C to stop the server"
echo
npm start
