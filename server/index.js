const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directories exist
async function ensureDirectories() {
  await fs.ensureDir(path.join(__dirname, 'uploads'));
  await fs.ensureDir(path.join(__dirname, 'uploads', 'temp'));
  await fs.ensureDir(path.join(__dirname, 'uploads', 'processed'));
}

// Routes
app.use('/api/upload', uploadRoutes);

// Simple analyze endpoint (mock implementation)
app.post('/api/analyze/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { model } = req.body;
    
    console.log(`Analysis request for job ${jobId} with model ${model}`);
    
    // Check if job exists
    const jobFilePath = path.join(__dirname, 'uploads', 'processed', `${jobId}.json`);
    
    if (!await fs.pathExists(jobFilePath)) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The specified job ID does not exist'
      });
    }

    const jobRecord = await fs.readJson(jobFilePath);
    
    if (jobRecord.status !== 'uploaded') {
      return res.status(400).json({
        error: 'Invalid job status',
        message: `Job is in ${jobRecord.status} status, expected 'uploaded'`
      });
    }

    // Update job status to processing
    jobRecord.status = 'processing';
    jobRecord.analysisStartedAt = new Date().toISOString();
    jobRecord.model = model;
    await fs.writeJson(jobFilePath, jobRecord);

    // Simulate analysis processing time
    setTimeout(async () => {
      try {
        // Create mock analysis result
        const mockResult = {
          jobId,
          status: 'completed',
          patient: {
            name: 'John Doe',
            dob: '1980-01-15',
            sex: 'M',
            id: 'MRN123456'
          },
          medications: [
            {
              name: 'Amoxicillin',
              dose: '500 mg',
              frequency: 'TID',
              route: 'oral',
              raw_text: 'Amoxicillin 500mg TID for 7 days',
              confidence: 0.9
            }
          ],
          diagnoses: [
            {
              text: 'Upper respiratory tract infection',
              icd10: null,
              confidence: 0.85
            }
          ],
          labs: [
            {
              name: 'Hb',
              value: 12.5,
              units: 'g/dL',
              ref_range: '12-16',
              flag: 'normal',
              confidence: 0.9
            }
          ],
          vitals: {
            temperature: '98.6°F',
            bloodPressure: '120/80',
            heartRate: '72 bpm'
          },
          impression: 'Patient presents with symptoms consistent with upper respiratory tract infection. Laboratory values are within normal limits.',
          recommendations: [
            {
              text: 'Continue current antibiotic therapy',
              urgency: 'non-urgent'
            },
            {
              text: 'Follow up in 3-5 days if symptoms persist',
              urgency: 'non-urgent'
            }
          ],
          confidence_overall: 0.85,
          source_pages: [
            {
              pageNumber: 1,
              text: 'Patient: John Doe, DOB: 01/15/1980...',
              wordCount: 150
            }
          ],
          timestamps: {
            uploadedAt: jobRecord.uploadedAt,
            analyzedAt: new Date().toISOString()
          },
          notes: ['This is a mock analysis result for demonstration purposes'],
          patient_summary: 'Your medical document has been analyzed. The system identified an upper respiratory tract infection with normal laboratory values. Continue your prescribed antibiotic treatment and follow up with your healthcare provider if symptoms persist. This is not medical advice.',
          llm_provider: model || 'mock',
          llm_model: model === 'openai' ? 'gpt-4' : 'llama3',
          extraction_method: 'pdf-parse',
          file_metadata: {
            originalFilename: jobRecord.originalFilename,
            fileSize: jobRecord.fileSize
          }
        };

        // Update job record with results
        jobRecord.status = 'completed';
        jobRecord.completedAt = new Date().toISOString();
        jobRecord.result = mockResult;
        await fs.writeJson(jobFilePath, jobRecord);

        console.log(`Analysis completed for job ${jobId}`);
      } catch (error) {
        console.error(`Analysis failed for job ${jobId}:`, error);
        
        // Update job record with error
        jobRecord.status = 'failed';
        jobRecord.failedAt = new Date().toISOString();
        jobRecord.error = error.message;
        await fs.writeJson(jobFilePath, jobRecord);
      }
    }, 3000); // 3 second delay to simulate processing

    res.json({
      jobId,
      status: 'processing',
      message: 'Analysis started successfully'
    });

  } catch (error) {
    console.error('Analyze endpoint error:', error);
    res.status(500).json({
      error: 'Analysis request failed',
      message: error.message || 'An error occurred while starting analysis'
    });
  }
});

// Simple result endpoint
app.get('/api/result/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const jobFilePath = path.join(__dirname, 'uploads', 'processed', `${jobId}.json`);
    
    if (!await fs.pathExists(jobFilePath)) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The specified job ID does not exist'
      });
    }

    const jobRecord = await fs.readJson(jobFilePath);
    
    const response = {
      jobId: jobRecord.jobId,
      status: jobRecord.status,
      uploadedAt: jobRecord.uploadedAt,
      filename: jobRecord.originalFilename
    };

    if (jobRecord.status === 'completed' && jobRecord.result) {
      response.result = jobRecord.result;
    } else if (jobRecord.status === 'failed') {
      response.error = jobRecord.error;
    } else if (jobRecord.status === 'processing') {
      response.processingStartedAt = jobRecord.analysisStartedAt;
    }

    res.json(response);

  } catch (error) {
    console.error('Result retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve result',
      message: 'An error occurred while retrieving the analysis result'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message || 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  try {
    await ensureDirectories();
    app.listen(PORT, () => {
      console.log(`Medical PDF Analyzer server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
