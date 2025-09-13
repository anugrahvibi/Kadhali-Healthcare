# 🩺 Medical PDF Analyzer

A secure, production-ready web application that analyzes medical PDFs using advanced LLM technology. Extract structured clinical information, generate patient summaries, and create downloadable reports while maintaining strict PHI protection standards.

## ✨ Features

### 🔒 Security & Compliance
- **PHI Protection**: Configurable external processing with proper consent handling
- **File Encryption**: Optional encryption at rest for uploaded files
- **Audit Logging**: Comprehensive logging and job tracking
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Secure file upload with virus scanning simulation

### 📄 PDF Processing
- **Smart Text Extraction**: PDF parsing with OCR fallback for scanned documents
- **Medical Data Extraction**: Rule-based extraction of patient info, medications, labs, diagnoses
- **Multi-format Support**: Handles both text-selectable and scanned PDFs

### 🤖 LLM Integration
- **OpenAI GPT-4**: High-quality analysis with external processing
- **Llama 3 Local**: Self-hosted inference for complete PHI control
- **Configurable Models**: Easy switching between providers
- **Structured Output**: JSON-formatted results with confidence scores

### 📊 Analysis & Reporting
- **Clinical Reports**: Structured JSON with patient info, medications, labs, diagnoses
- **Patient Summaries**: Plain-language explanations (≤200 words)
- **Urgent Alerts**: Automatic flagging of critical recommendations
- **PDF Reports**: Downloadable clinical reports with disclaimers
- **Follow-up Questions**: Interactive Q&A with analysis context

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- (Optional) OpenAI API key for external processing
- (Optional) Local Llama 3 instance for on-premises processing

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd medical-pdf-analyzer
   ```

2. **Start the backend server**
   ```bash
   # Windows
   start-server.bat
   
   # Linux/macOS
   ./start-server.sh
   ```

3. **Open the frontend**
   - Navigate to `faq.html` in your browser
   - The PDF analyzer will be available in the new "Upload & Analyze Report" section

### Configuration

Edit `server/.env` file:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Security Settings
ALLOW_EXTERNAL_PHI_PROCESSING=false
MAX_FILE_SIZE_MB=10
RETENTION_DAYS=30

# OpenAI Configuration (if using OpenAI)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Local LLM Configuration (if using Llama)
LLAMA_API_URL=http://localhost:11434
LLAMA_MODEL=llama3
```

## 📖 Usage

### 1. Upload PDF
- Check the consent checkbox
- Drag & drop or click to upload a medical PDF
- Wait for upload confirmation

### 2. Choose Analysis Model
- **OpenAI GPT-4**: High-quality analysis (requires API key and PHI consent)
- **Llama 3 Local**: On-premises analysis (no external data transmission)

### 3. View Results
- **Patient Summary**: Plain-language explanation of findings
- **Urgent Alerts**: Critical recommendations highlighted in red
- **Structured Data**: Detailed JSON with extracted information
- **Download Report**: PDF report for sharing with healthcare providers

## 🏗️ Architecture

### Frontend
- **HTML/CSS/JavaScript**: Vanilla implementation with Bootstrap
- **PDF.js**: Client-side PDF preview and text extraction
- **Responsive Design**: Mobile-friendly interface

### Backend
- **Node.js/Express**: RESTful API server
- **Multer**: File upload handling
- **PDF-parse**: Server-side PDF text extraction
- **Tesseract.js**: OCR for scanned documents
- **OpenAI SDK**: GPT-4 integration
- **jsPDF**: Report generation

### Data Flow
```
PDF Upload → File Validation → Text Extraction → Medical Parsing → LLM Analysis → Report Generation
```

## 🔧 API Endpoints

### Upload
- `POST /api/upload/pdf` - Upload PDF file
- `GET /api/upload/status/:jobId` - Check upload status

### Analysis
- `POST /api/analyze/:jobId` - Start analysis
- `GET /api/analyze/models` - Get available models

### Results
- `GET /api/result/:jobId` - Get analysis results
- `GET /api/result/:jobId/report.pdf` - Download PDF report

## 🛡️ Security Features

### PHI Protection
- **Default Off**: External processing disabled by default
- **Consent Required**: User must explicitly consent to data processing
- **Configurable**: Easy toggle for external vs. local processing
- **Audit Trail**: Complete logging of all PHI access

### File Security
- **Validation**: PDF format and size validation
- **Encryption**: Optional file encryption at rest
- **Virus Scanning**: Basic file validation (extensible)
- **Retention**: Configurable file retention policies

### API Security
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configurable cross-origin policies
- **Helmet Security**: Security headers
- **Input Validation**: Comprehensive request validation

## 📋 Compliance

### HIPAA (US)
- Administrative, physical, and technical safeguards
- Business Associate Agreement (BAA) required for OpenAI
- Risk assessment and audit logging
- Staff training and incident response

### GDPR (EU)
- Data processing lawfulness
- User consent mechanisms
- Data subject rights
- Cross-border transfer safeguards

### Local Regulations
- Configurable for regional requirements
- Regular compliance reviews
- Legal consultation recommended

## 🚀 Deployment

### Development
```bash
cd server
npm install
npm run dev
```

### Production
1. **Security Checklist**: Complete `docs/security-checklist.md`
2. **Environment Setup**: Configure production `.env`
3. **SSL/TLS**: Set up HTTPS certificates
4. **Monitoring**: Implement logging and alerting
5. **Backup**: Configure data backup strategy

### Docker
```bash
docker build -t medical-pdf-analyzer .
docker run -p 3001:3001 medical-pdf-analyzer
```

### Kubernetes
See `docs/deploy-llama3.md` for Kubernetes deployment examples.

## 🧪 Testing

### Backend Tests
```bash
cd server
npm test
```

### Manual Testing
1. Upload a sample medical PDF
2. Verify text extraction works
3. Test both OpenAI and Llama analysis
4. Check PDF report generation
5. Validate security features

## 📚 Documentation

- [Backend API Documentation](server/README.md)
- [Llama 3 Deployment Guide](docs/deploy-llama3.md)
- [Security Checklist](docs/security-checklist.md)
- [Configuration Examples](server/config.example.env)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This tool provides automated assistance and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider for medical decisions.

## 🆘 Support

- **Issues**: Report bugs and feature requests via GitHub Issues
- **Documentation**: Check the docs/ folder for detailed guides
- **Security**: Report security issues privately to the maintainers

---

**Made with ❤️ by Team HackNova | Powered by Modern AI Technology**
