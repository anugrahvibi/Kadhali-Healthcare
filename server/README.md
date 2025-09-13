# Medical PDF Analyzer Backend

A secure, production-ready backend service for analyzing medical PDFs using LLM technology.

## Features

- **Secure PDF Upload**: File validation, encryption, and virus scanning
- **Text Extraction**: PDF parsing with OCR fallback for scanned documents
- **Medical Data Extraction**: Rule-based extraction of patient info, medications, labs, diagnoses
- **LLM Analysis**: Support for OpenAI GPT-4 and local Llama 3 models
- **PHI Protection**: Configurable external processing with proper consent handling
- **PDF Report Generation**: Downloadable clinical reports
- **Audit Logging**: Comprehensive logging and job tracking

## Quick Start

1. **Install Dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp config.example.env .env
   # Edit .env with your settings
   ```

3. **Start Server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `ALLOW_EXTERNAL_PHI_PROCESSING` | Allow OpenAI processing | false |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `LLAMA_API_URL` | Local Llama API URL | http://localhost:11434 |
| `MAX_FILE_SIZE_MB` | Max upload size | 10 |
| `RETENTION_DAYS` | File retention period | 30 |

### LLM Providers

#### OpenAI (External)
- Requires API key
- High-quality analysis
- PHI sent to external service
- Requires BAA for production use

#### Llama 3 (Local)
- Self-hosted inference
- No external PHI transmission
- Requires local GPU infrastructure
- More control over data

## API Endpoints

### Upload
- `POST /api/upload/pdf` - Upload PDF file
- `GET /api/upload/status/:jobId` - Check upload status

### Analysis
- `POST /api/analyze/:jobId` - Start analysis
- `GET /api/analyze/models` - Get available models

### Results
- `GET /api/result/:jobId` - Get analysis results
- `GET /api/result/:jobId/report.pdf` - Download PDF report

## Security Features

- **File Validation**: PDF format and size validation
- **Encryption**: Optional file encryption at rest
- **Rate Limiting**: API rate limiting (100 req/15min)
- **CORS Protection**: Configurable CORS policies
- **Helmet Security**: Security headers
- **PHI Controls**: Configurable external processing

## Development

### Project Structure
```
server/
├── routes/           # API route handlers
├── utils/           # Utility functions
├── config.js        # Configuration management
├── index.js         # Main server file
└── package.json     # Dependencies
```

### Testing
```bash
npm test
```

### Logging
Logs are written to `./logs/app.log` with configurable levels.

## Production Deployment

1. **Security Checklist**
   - [ ] Set `NODE_ENV=production`
   - [ ] Configure proper CORS origins
   - [ ] Set up SSL/TLS certificates
   - [ ] Configure file encryption keys
   - [ ] Set up proper backup strategy
   - [ ] Configure monitoring and alerting

2. **Docker Deployment**
   ```bash
   docker build -t medical-pdf-analyzer .
   docker run -p 3001:3001 medical-pdf-analyzer
   ```

3. **Environment Setup**
   - Use environment-specific configuration
   - Set up proper logging aggregation
   - Configure health checks
   - Set up auto-scaling if needed

## Compliance Notes

- **HIPAA**: Ensure proper BAAs for external services
- **GDPR**: Implement data retention and deletion policies
- **Local Laws**: Check regional healthcare data regulations

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size limits
   - Verify PDF format
   - Check disk space

2. **LLM Analysis Fails**
   - Verify API keys/URLs
   - Check model availability
   - Review PHI processing settings

3. **Performance Issues**
   - Monitor memory usage
   - Check file processing times
   - Review LLM response times

### Logs
Check `./logs/app.log` for detailed error information.

## License

MIT License - see LICENSE file for details.
