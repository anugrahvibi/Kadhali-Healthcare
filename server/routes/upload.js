const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const tempDir = path.join(uploadDir, 'temp');
const processedDir = path.join(uploadDir, 'processed');

// Create directories if they don't exist
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(tempDir);
fs.ensureDirSync(processedDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log('File received:', file.originalname, 'Type:', file.mimetype);
    
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      console.log('Invalid file type:', file.mimetype);
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// POST /api/upload/pdf
router.post('/pdf', upload.single('file'), async (req, res) => {
  console.log('=== UPLOAD REQUEST RECEIVED ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('File:', req.file);
  console.log('================================');
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a PDF file to upload'
      });
    }

    // Check consent
    if (req.body.consent !== 'true') {
      console.log('Consent not given');
      return res.status(400).json({
        error: 'Consent required',
        message: 'You must consent to processing your medical data'
      });
    }

    const jobId = uuidv4();
    const originalFilename = req.file.originalname;
    const tempFilePath = req.file.path;

    console.log(`Processing file: ${originalFilename} (Job ID: ${jobId})`);

    // Basic file validation
    if (req.file.size === 0) {
      await fs.remove(tempFilePath);
      return res.status(400).json({
        error: 'Invalid file',
        message: 'File is empty'
      });
    }

    if (req.file.size > 10 * 1024 * 1024) {
      await fs.remove(tempFilePath);
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must be less than 10MB'
      });
    }

    // Move file to permanent storage
    const finalPath = path.join(uploadDir, `${jobId}.pdf`);
    await fs.move(tempFilePath, finalPath);

    // Create job record
    const jobRecord = {
      jobId,
      originalFilename,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      filePath: finalPath,
      fileSize: req.file.size,
      consentGiven: true
    };

    // Store job record
    await fs.writeJson(path.join(processedDir, `${jobId}.json`), jobRecord);

    console.log(`File upload completed: ${originalFilename} (Job ID: ${jobId})`);

    res.json({
      jobId,
      message: 'File uploaded successfully',
      filename: originalFilename,
      uploadedAt: jobRecord.uploadedAt,
      fileSize: req.file.size
    });

  } catch (error) {
    console.error('=== UPLOAD ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('===================');
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Upload failed',
      message: error.message || 'An error occurred while processing your file'
    });
  }
});

module.exports = router;
