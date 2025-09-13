const fs = require('fs-extra');
const crypto = require('crypto');
const path = require('path');
const logger = require('./logger');

/**
 * Validate uploaded file for security
 * @param {string} filePath - Path to the file to validate
 * @returns {Promise<{isValid: boolean, reason?: string}>}
 */
async function validateFile(filePath) {
  try {
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return { isValid: false, reason: 'File does not exist' };
    }

    // Check file size
    const stats = await fs.stat(filePath);
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (stats.size > maxSize) {
      return { isValid: false, reason: 'File size exceeds maximum allowed size' };
    }

    if (stats.size === 0) {
      return { isValid: false, reason: 'File is empty' };
    }

    // Basic file type validation by reading first few bytes
    const buffer = await fs.readFile(filePath, { start: 0, end: 4 });
    const header = buffer.toString('hex');
    
    // PDF files start with %PDF
    if (!header.startsWith('25504446')) { // %PDF in hex
      return { isValid: false, reason: 'File is not a valid PDF' };
    }

    // In production, you would add:
    // - Virus scanning
    // - Malware detection
    // - Content validation
    // - File structure analysis

    return { isValid: true };

  } catch (error) {
    logger.error('File validation error:', error);
    return { isValid: false, reason: 'File validation failed' };
  }
}

/**
 * Encrypt file using AES-256-GCM
 * @param {string} inputPath - Path to input file
 * @param {string} outputPath - Path to output encrypted file
 */
async function encryptFile(inputPath, outputPath) {
  try {
    const algorithm = 'aes-256-gcm';
    const key = crypto.randomBytes(32); // Generate random key
    const iv = crypto.randomBytes(16); // Generate random IV

    const cipher = crypto.createCipher(algorithm, key);
    const input = await fs.readFile(inputPath);
    
    let encrypted = cipher.update(input, null, 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Store encrypted data with IV and auth tag
    const encryptedData = {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm
    };
    
    await fs.writeJson(outputPath, encryptedData);
    
    // In production, store the key securely (e.g., AWS KMS, Azure Key Vault)
    logger.warn('File encrypted but key not stored securely - implement proper key management');
    
  } catch (error) {
    logger.error('File encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
}

/**
 * Decrypt file
 * @param {string} inputPath - Path to encrypted file
 * @param {string} outputPath - Path to output decrypted file
 */
async function decryptFile(inputPath, outputPath) {
  try {
    const encryptedData = await fs.readJson(inputPath);
    
    const algorithm = encryptedData.algorithm;
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-long-12345', 'utf8');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', null);
    decrypted += decipher.final();
    
    await fs.writeFile(outputPath, decrypted);
    
  } catch (error) {
    logger.error('File decryption error:', error);
    throw new Error('Failed to decrypt file');
  }
}

/**
 * Generate file hash for integrity checking
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} - SHA-256 hash
 */
async function generateFileHash(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (error) {
    logger.error('Hash generation error:', error);
    throw new Error('Failed to generate file hash');
  }
}

/**
 * Clean up old files based on retention policy
 * @param {number} retentionDays - Number of days to retain files
 */
async function cleanupOldFiles(retentionDays = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const uploadDir = path.join(__dirname, '../uploads');
    const files = await fs.readdir(uploadDir, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isFile()) {
        const filePath = path.join(uploadDir, file.name);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
          logger.info(`Cleaned up old file: ${file.name}`);
        }
      }
    }
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
}

module.exports = {
  validateFile,
  encryptFile,
  decryptFile,
  generateFileHash,
  cleanupOldFiles
};
