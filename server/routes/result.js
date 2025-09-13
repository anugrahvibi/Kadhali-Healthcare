const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const jsPDF = require('jspdf');

const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

// GET /api/result/:jobId
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Validate jobId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      return res.status(400).json({
        error: 'Invalid job ID format'
      });
    }

    const jobFilePath = path.join(config.storage.processedPath, `${jobId}.json`);
    
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
      response.resultUrl = `/api/result/${jobId}/report.pdf`;
    } else if (jobRecord.status === 'failed') {
      response.error = jobRecord.error;
    } else if (jobRecord.status === 'processing') {
      response.processingStartedAt = jobRecord.analysisStartedAt;
    }

    res.json(response);

  } catch (error) {
    logger.error('Result retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve result',
      message: 'An error occurred while retrieving the analysis result'
    });
  }
});

// GET /api/result/:jobId/report.pdf - Generate and download PDF report
router.get('/:jobId/report.pdf', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Validate jobId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      return res.status(400).json({
        error: 'Invalid job ID format'
      });
    }

    const jobFilePath = path.join(config.storage.processedPath, `${jobId}.json`);
    
    if (!await fs.pathExists(jobFilePath)) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    const jobRecord = await fs.readJson(jobFilePath);
    
    if (jobRecord.status !== 'completed' || !jobRecord.result) {
      return res.status(400).json({
        error: 'Report not available',
        message: 'Analysis is not completed yet'
      });
    }

    const result = jobRecord.result;
    
    // Generate PDF report
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Helper function to add text with word wrapping
    const addText = (text, x, y, maxWidth, fontSize = 10) => {
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return y + (lines.length * fontSize * 0.4);
    };

    // Helper function to check if we need a new page
    const checkNewPage = (requiredSpace) => {
      if (yPosition + requiredSpace > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
        return true;
      }
      return false;
    };

    // Header
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Medical Document Analysis Report', 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Job ID: ${jobId}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Original File: ${result.file_metadata.originalFilename}`, 20, yPosition);
    yPosition += 15;

    // Patient Information
    if (result.patient && Object.keys(result.patient).length > 0) {
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Patient Information', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      
      if (result.patient.name) {
        yPosition = addText(`Name: ${result.patient.name}`, 20, yPosition, pageWidth - 40);
      }
      if (result.patient.dob) {
        yPosition = addText(`Date of Birth: ${result.patient.dob}`, 20, yPosition, pageWidth - 40);
      }
      if (result.patient.sex) {
        yPosition = addText(`Sex: ${result.patient.sex}`, 20, yPosition, pageWidth - 40);
      }
      if (result.patient.id) {
        yPosition = addText(`ID: ${result.patient.id}`, 20, yPosition, pageWidth - 40);
      }
      yPosition += 10;
    }

    // Medications
    if (result.medications && result.medications.length > 0) {
      checkNewPage(30);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Medications', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      
      result.medications.forEach((med, index) => {
        checkNewPage(20);
        const medText = `${index + 1}. ${med.name || 'Unknown'} - ${med.dose || 'N/A'} ${med.frequency || ''} ${med.route || ''}`;
        yPosition = addText(medText, 20, yPosition, pageWidth - 40);
        if (med.raw_text) {
          yPosition = addText(`   Raw: ${med.raw_text}`, 20, yPosition, pageWidth - 40, 8);
        }
        yPosition += 5;
      });
      yPosition += 10;
    }

    // Lab Results
    if (result.labs && result.labs.length > 0) {
      checkNewPage(30);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Laboratory Results', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      
      result.labs.forEach((lab, index) => {
        checkNewPage(15);
        const labText = `${index + 1}. ${lab.name} - ${lab.value} ${lab.units} ${lab.flag ? `(${lab.flag})` : ''}`;
        yPosition = addText(labText, 20, yPosition, pageWidth - 40);
        if (lab.ref_range) {
          yPosition = addText(`   Reference: ${lab.ref_range}`, 20, yPosition, pageWidth - 40, 8);
        }
        yPosition += 5;
      });
      yPosition += 10;
    }

    // Diagnoses
    if (result.diagnoses && result.diagnoses.length > 0) {
      checkNewPage(30);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Diagnoses', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      
      result.diagnoses.forEach((dx, index) => {
        checkNewPage(15);
        yPosition = addText(`${index + 1}. ${dx.text}`, 20, yPosition, pageWidth - 40);
        yPosition += 5;
      });
      yPosition += 10;
    }

    // Clinical Impression
    if (result.impression) {
      checkNewPage(30);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Clinical Impression', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      yPosition = addText(result.impression, 20, yPosition, pageWidth - 40);
      yPosition += 15;
    }

    // Recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      checkNewPage(30);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Recommendations', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      
      result.recommendations.forEach((rec, index) => {
        checkNewPage(15);
        const urgencyColor = rec.urgency === 'urgent' ? [255, 0, 0] : [0, 0, 0];
        pdf.setTextColor(urgencyColor[0], urgencyColor[1], urgencyColor[2]);
        yPosition = addText(`${index + 1}. ${rec.text} ${rec.urgency === 'urgent' ? '(URGENT)' : ''}`, 20, yPosition, pageWidth - 40);
        pdf.setTextColor(0, 0, 0); // Reset color
        yPosition += 5;
      });
      yPosition += 10;
    }

    // Patient Summary
    if (result.patient_summary) {
      checkNewPage(40);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Patient Summary', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      yPosition = addText(result.patient_summary, 20, yPosition, pageWidth - 40);
      yPosition += 15;
    }

    // Footer with disclaimers
    checkNewPage(30);
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'italic');
    pdf.setTextColor(100, 100, 100);
    
    const disclaimer = [
      'DISCLAIMER: This report is generated by automated analysis and is for informational purposes only.',
      'It is not a substitute for professional medical advice, diagnosis, or treatment.',
      'Always consult with a qualified healthcare provider for medical decisions.',
      `Analysis completed using ${result.llm_provider} (${result.llm_model}) with ${result.extraction_method}.`,
      `Overall confidence: ${Math.round((result.confidence_overall || 0) * 100)}%`
    ];
    
    disclaimer.forEach(line => {
      yPosition = addText(line, 20, yPosition, pageWidth - 40, 8);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="medical-report-${jobId}.pdf"`);
    
    // Send PDF
    const pdfBuffer = pdf.output('arraybuffer');
    res.send(Buffer.from(pdfBuffer));

    logger.info(`PDF report generated for job ${jobId}`);

  } catch (error) {
    logger.error('PDF generation error:', error);
    res.status(500).json({
      error: 'Failed to generate PDF report',
      message: 'An error occurred while generating the PDF report'
    });
  }
});

module.exports = router;
