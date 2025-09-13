@echo off
echo Starting Medical PDF Analyzer Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "server\package.json" (
    echo Error: server\package.json not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Navigate to server directory
cd server

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file from template...
    copy config.example.env .env
    echo.
    echo IMPORTANT: Please edit .env file to configure your settings
    echo - Set OPENAI_API_KEY if using OpenAI
    echo - Set LLAMA_API_URL if using local Llama
    echo - Configure ALLOW_EXTERNAL_PHI_PROCESSING as needed
    echo.
    pause
)

REM Start the server
echo Starting server...
echo Server will be available at: http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo.
npm start
