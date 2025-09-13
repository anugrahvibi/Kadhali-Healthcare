const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

/**
 * Extract text from PDF using pdf-parse
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<{text: string, pages: Array, metadata: Object}>}
 */
async function extractTextFromPDF(filePath) {
  try {
    logger.info(`Extracting text from PDF: ${filePath}`);
    
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    const result = {
      text: data.text,
      pages: data.pages || [],
      metadata: {
        pages: data.numpages,
        info: data.info,
        version: data.version
      },
      extractionMethod: 'pdf-parse'
    };
    
    logger.info(`PDF text extraction completed. Pages: ${data.numpages}, Text length: ${data.text.length}`);
    return result;
    
  } catch (error) {
    logger.error('PDF text extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from PDF using OCR (Tesseract.js)
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<{text: string, pages: Array, metadata: Object}>}
 */
async function extractTextWithOCR(filePath) {
  try {
    logger.info(`Starting OCR extraction from PDF: ${filePath}`);
    
    // For now, we'll use a simplified approach
    // In production, you'd convert PDF pages to images first
    const result = await Tesseract.recognize(filePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          logger.info(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    const extractedResult = {
      text: result.data.text,
      pages: [{
        pageNumber: 1,
        text: result.data.text,
        confidence: result.data.confidence
      }],
      metadata: {
        pages: 1,
        confidence: result.data.confidence,
        words: result.data.words?.length || 0
      },
      extractionMethod: 'tesseract-ocr'
    };
    
    logger.info(`OCR extraction completed. Confidence: ${result.data.confidence}%`);
    return extractedResult;
    
  } catch (error) {
    logger.error('OCR extraction error:', error);
    throw new Error('Failed to extract text using OCR');
  }
}

/**
 * Smart text extraction - tries PDF parsing first, falls back to OCR
 * @param {string} filePath - Path to PDF file
 * @param {boolean} forceOCR - Force OCR even if PDF text extraction works
 * @returns {Promise<{text: string, pages: Array, metadata: Object}>}
 */
async function extractText(filePath, forceOCR = false) {
  try {
    if (forceOCR) {
      return await extractTextWithOCR(filePath);
    }
    
    // Try PDF text extraction first
    const pdfResult = await extractTextFromPDF(filePath);
    
    // Check if we got meaningful text
    const textLength = pdfResult.text.trim().length;
    const minTextLength = 50; // Minimum characters to consider as meaningful text
    
    if (textLength >= minTextLength) {
      logger.info('PDF text extraction successful');
      return pdfResult;
    } else {
      logger.info('PDF text extraction yielded minimal text, trying OCR');
      return await extractTextWithOCR(filePath);
    }
    
  } catch (error) {
    logger.error('Text extraction failed, trying OCR fallback:', error);
    
    try {
      return await extractTextWithOCR(filePath);
    } catch (ocrError) {
      logger.error('Both PDF and OCR extraction failed:', ocrError);
      throw new Error('Failed to extract text from PDF using both methods');
    }
  }
}

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters that might interfere with parsing
    .replace(/[^\w\s\.\,\;\:\!\?\-\(\)\[\]\{\}\/\@\#\$\%\&\*\+\=\<\>\|\~\`\'\"]/g, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove multiple consecutive line breaks
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Split text into pages (if page information is available)
 * @param {string} text - Full text
 * @param {Array} pages - Page information array
 * @returns {Array} - Array of page objects with text
 */
function splitTextIntoPages(text, pages = []) {
  if (!pages || pages.length === 0) {
    // If no page info, split by approximate page length
    const wordsPerPage = 250; // Approximate words per page
    const words = text.split(/\s+/);
    const pageCount = Math.ceil(words.length / wordsPerPage);
    
    const result = [];
    for (let i = 0; i < pageCount; i++) {
      const start = i * wordsPerPage;
      const end = Math.min(start + wordsPerPage, words.length);
      const pageText = words.slice(start, end).join(' ');
      
      result.push({
        pageNumber: i + 1,
        text: pageText,
        wordCount: end - start
      });
    }
    return result;
  }
  
  return pages.map((page, index) => ({
    pageNumber: index + 1,
    text: page.text || '',
    wordCount: page.text ? page.text.split(/\s+/).length : 0,
    confidence: page.confidence || null
  }));
}

module.exports = {
  extractText,
  extractTextFromPDF,
  extractTextWithOCR,
  cleanText,
  splitTextIntoPages
};
