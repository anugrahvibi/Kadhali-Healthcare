const path = require('path');

const config = {
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development'
  },
  
  security: {
    allowExternalPHI: process.env.ALLOW_EXTERNAL_PHI_PROCESSING === 'true',
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 10,
    retentionDays: parseInt(process.env.RETENTION_DAYS) || 30,
    encryptFiles: process.env.ENCRYPT_FILES !== 'false'
  },
  
  llm: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      enabled: !!process.env.OPENAI_API_KEY
    },
    llama: {
      apiUrl: process.env.LLAMA_API_URL || 'http://localhost:11434',
      model: process.env.LLAMA_MODEL || 'llama3',
      enabled: process.env.LLAMA_API_URL !== undefined
    }
  },
  
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    uploadPath: path.resolve(process.env.STORAGE_PATH || './uploads/original'),
    processedPath: path.resolve(process.env.STORAGE_PATH || './uploads/processed'),
    tempPath: path.resolve(process.env.STORAGE_PATH || './uploads/temp')
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  }
};

// Validation
if (!config.llm.openai.enabled && !config.llm.llama.enabled) {
  console.warn('Warning: No LLM provider configured. Set OPENAI_API_KEY or LLAMA_API_URL');
}

if (config.security.allowExternalPHI) {
  console.warn('Warning: External PHI processing is ENABLED. Ensure you have proper BAAs in place.');
}

module.exports = config;
