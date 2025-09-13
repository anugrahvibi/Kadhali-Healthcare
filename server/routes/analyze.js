const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const Joi = require('joi');

const logger = require('../utils/logger');
const config = require('../config');
const { extractText } = require('../utils/textExtraction');
const { extractMedicalData } = require('../utils/medicalExtraction');
const { analyzeWithLLM } = require('../utils/llmIntegration');
const { decryptFile } = require('../utils/fileUtils');

const router = express.Router();

// Validation schema
const analyzeSchema = Joi.object({
  model: Joi.string().valid('openai', 'llama').required(),
  options: Joi.object({
    ocr: Joi.boolean().default(false),
    embeddings: Joi.boolean().default(false)
  }).default({})
});

// POST /api/analyze/:jobId
router.post('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Validate jobId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      return res.status(400).json({
        error: 'Invalid job ID format'
      });
    }

    // Validate request body
    const { error, value } = analyzeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { model, options } = value;

    // Check if job exists
    const jobFilePath = path.join(config.storage.processedPath, `${jobId}.json`);
    if (!await fs.pathExists(jobFilePath)) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The specified job ID does not exist'
      });
    }

    // Load job record
    const jobRecord = await fs.readJson(jobFilePath);
    
    if (jobRecord.status !== 'uploaded') {
      return res.status(400).json({
        error: 'Invalid job status',
        message: `Job is in ${jobRecord.status} status, expected 'uploaded'`
      });
    }

    // Update job status
    jobRecord.status = 'processing';
    jobRecord.analysisStartedAt = new Date().toISOString();
    jobRecord.model = model;
    jobRecord.options = options;
    await fs.writeJson(jobFilePath, jobRecord);

    logger.info(`Starting analysis for job ${jobId} with model ${model}`);

    // Check if model is available
    if (model === 'openai' && !config.llm.openai.enabled) {
      throw new Error('OpenAI is not configured');
    }
    if (model === 'llama' && !config.llm.llama.enabled) {
      throw new Error('Llama is not configured');
    }

    // Check PHI processing permissions
    if (model === 'openai' && !config.security.allowExternalPHI) {
      throw new Error('External PHI processing is disabled. Cannot use OpenAI.');
    }

    // Prepare file for processing
    let filePath = jobRecord.filePath;
    if (config.security.encryptFiles) {
      // Decrypt file to temp location
      const tempPath = path.join(config.storage.tempPath, `${jobId}_decrypted.pdf`);
      await decryptFile(filePath, tempPath);
      filePath = tempPath;
    }

    try {
      // Step 1: Extract text from PDF
      logger.info(`Extracting text from PDF for job ${jobId}`);
      const textResult = await extractText(filePath, options.ocr);
      
      // Step 2: Extract structured medical data using rules
      logger.info(`Extracting medical data for job ${jobId}`);
      const baselineData = extractMedicalData(textResult.text);
      
      // Step 3: Analyze with LLM
      logger.info(`Running LLM analysis for job ${jobId}`);
      const llmResult = await analyzeWithLLM(textResult.text, baselineData, model);
      
      // Step 4: Combine results
      const finalResult = {
        jobId,
        status: 'completed',
        patient: llmResult.patient,
        medications: llmResult.medications,
        diagnoses: llmResult.diagnoses,
        labs: llmResult.labs,
        vitals: baselineData.vitals,
        impression: llmResult.impression,
        recommendations: llmResult.recommendations,
        confidence_overall: llmResult.confidence_overall,
        source_pages: llmResult.source_pages || textResult.pages,
        timestamps: {
          uploadedAt: jobRecord.uploadedAt,
          analyzedAt: new Date().toISOString()
        },
        notes: llmResult.notes || [],
        patient_summary: llmResult.patient_summary,
        llm_provider: llmResult.llm_provider,
        llm_model: llmResult.llm_model,
        extraction_method: textResult.extractionMethod,
        file_metadata: {
          originalFilename: jobRecord.originalFilename,
          fileSize: jobRecord.fileSize
        }
      };

      // Update job record with results
      jobRecord.status = 'completed';
      jobRecord.completedAt = new Date().toISOString();
      jobRecord.result = finalResult;
      await fs.writeJson(jobFilePath, jobRecord);

      // Clean up decrypted temp file
      if (config.security.encryptFiles && filePath !== jobRecord.filePath) {
        await fs.remove(filePath);
      }

      logger.info(`Analysis completed successfully for job ${jobId}`);

      res.json({
        jobId,
        status: 'completed',
        message: 'Analysis completed successfully',
        resultUrl: `/api/result/${jobId}`
      });

    } catch (analysisError) {
      logger.error(`Analysis failed for job ${jobId}:`, analysisError);
      
      // Update job record with error
      jobRecord.status = 'failed';
      jobRecord.failedAt = new Date().toISOString();
      jobRecord.error = analysisError.message;
      await fs.writeJson(jobFilePath, jobRecord);

      // Clean up decrypted temp file
      if (config.security.encryptFiles && filePath !== jobRecord.filePath) {
        try {
          await fs.remove(filePath);
        } catch (cleanupError) {
          logger.error('Failed to cleanup temp file:', cleanupError);
        }
      }

      res.status(500).json({
        error: 'Analysis failed',
        message: analysisError.message
      });
    }

  } catch (error) {
    logger.error('Analyze endpoint error:', error);
    res.status(500).json({
      error: 'Analysis request failed',
      message: 'An error occurred while processing your analysis request'
    });
  }
});

// GET /api/analyze/models - Get available models
router.get('/models', (req, res) => {
  const availableModels = [];
  
  if (config.llm.openai.enabled) {
    availableModels.push({
      id: 'openai',
      name: 'OpenAI GPT-4',
      description: 'High-quality analysis using OpenAI GPT-4',
      requiresPHI: true,
      enabled: config.security.allowExternalPHI
    });
  }
  
  if (config.llm.llama.enabled) {
    availableModels.push({
      id: 'llama',
      name: 'Llama 3 (Local)',
      description: 'Local analysis using Llama 3',
      requiresPHI: false,
      enabled: true
    });
  }
  
  res.json({
    models: availableModels,
    defaultModel: availableModels.find(m => m.enabled)?.id || null
  });
});

module.exports = router;
