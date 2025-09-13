const logger = require('./logger');

/**
 * Extract patient information using regex patterns
 * @param {string} text - Extracted text from PDF
 * @returns {Object} - Structured patient information
 */
function extractPatientInfo(text) {
  const patterns = {
    name: [
      /(?:patient|name|pt\.?)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /(?:mr\.?|mrs\.?|ms\.?|dr\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
    ],
    dob: [
      /(?:dob|date\s+of\s+birth|birth\s+date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g
    ],
    sex: [
      /(?:sex|gender)\s*:?\s*(male|female|m|f)/gi
    ],
    id: [
      /(?:mrn|id|patient\s+id|medical\s+record)\s*:?\s*([A-Z0-9\-]+)/gi
    ]
  };

  const result = { name: null, dob: null, sex: null, id: null };

  // Extract name
  for (const pattern of patterns.name) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      result.name = match[1].trim();
      break;
    }
  }

  // Extract DOB
  for (const pattern of patterns.dob) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      result.dob = normalizeDate(match[1]);
      break;
    }
  }

  // Extract sex
  for (const pattern of patterns.sex) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      result.sex = match[1].toLowerCase().startsWith('m') ? 'M' : 'F';
      break;
    }
  }

  // Extract ID
  for (const pattern of patterns.id) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      result.id = match[1].trim();
      break;
    }
  }

  return result;
}

/**
 * Extract medications from text
 * @param {string} text - Extracted text
 * @returns {Array} - Array of medication objects
 */
function extractMedications(text) {
  const medications = [];
  
  // Common medication patterns
  const patterns = [
    // Pattern: Drug Name Dose Frequency Route Duration
    /([A-Z][a-z]+(?:cin|mycin|illin|azole|pine|sartan|pril|olol|statin|mab))\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?))\s+([a-z]+(?:\s+[a-z]+)*)\s+(?:for\s+)?(\d+\s*(?:days?|weeks?|months?))?/gi,
    
    // Pattern: Rx: Drug Name Dose Frequency
    /(?:rx|prescription|medication)\s*:?\s*([A-Z][a-z]+(?:cin|mycin|illin|azole|pine|sartan|pril|olol|statin|mab))\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?))\s+([a-z]+(?:\s+[a-z]+)*)/gi,
    
    // Simple pattern: Drug Name Dose
    /([A-Z][a-z]+(?:cin|mycin|illin|azole|pine|sartan|pril|olol|statin|mab))\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|units?))/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medication = {
        name: match[1] || null,
        dose: match[2] || null,
        frequency: match[3] || null,
        route: extractRoute(match[0]),
        duration: match[4] || null,
        raw_text: match[0],
        confidence: 0.8
      };
      
      if (medication.name && medication.dose) {
        medications.push(medication);
      }
    }
  }

  return medications;
}

/**
 * Extract lab results from text
 * @param {string} text - Extracted text
 * @returns {Array} - Array of lab result objects
 */
function extractLabResults(text) {
  const labs = [];
  
  // Common lab patterns
  const patterns = [
    // Pattern: Test Name: Value Units (Reference Range)
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*:?\s*(\d+(?:\.\d+)?)\s*([a-z\/]+)\s*(?:\(([^)]+)\))?/gi,
    
    // Pattern: Hb: 12.5 g/dL (12-16)
    /(Hb|Hgb|Hemoglobin|WBC|RBC|Platelet|Glucose|Cholesterol|Creatinine|BUN|Sodium|Potassium|Chloride)\s*:?\s*(\d+(?:\.\d+)?)\s*([a-z\/]+)\s*(?:\(([^)]+)\))?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseFloat(match[2]);
      const refRange = match[4] || null;
      const flag = determineLabFlag(value, refRange);
      
      const lab = {
        name: match[1].trim(),
        value: value,
        units: match[3].trim(),
        ref_range: refRange,
        flag: flag,
        confidence: 0.85
      };
      
      labs.push(lab);
    }
  }

  return labs;
}

/**
 * Extract diagnoses from text
 * @param {string} text - Extracted text
 * @returns {Array} - Array of diagnosis objects
 */
function extractDiagnoses(text) {
  const diagnoses = [];
  
  // Diagnosis patterns
  const patterns = [
    /(?:diagnosis|dx|condition)\s*:?\s*([A-Z][a-z]+(?:\s+[a-z]+)*)/gi,
    /(?:impression|assessment)\s*:?\s*([A-Z][a-z]+(?:\s+[a-z]+)*)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const diagnosis = {
        text: match[1].trim(),
        icd10: null, // Would need ICD-10 mapping service
        confidence: 0.7
      };
      
      diagnoses.push(diagnosis);
    }
  }

  return diagnoses;
}

/**
 * Extract vital signs from text
 * @param {string} text - Extracted text
 * @returns {Object} - Vital signs object
 */
function extractVitals(text) {
  const vitals = {};
  
  const patterns = {
    temperature: /(?:temp|temperature)\s*:?\s*(\d+(?:\.\d+)?)\s*[°]?[fFcC]/gi,
    bloodPressure: /(?:bp|blood\s+pressure)\s*:?\s*(\d+)\/(\d+)/gi,
    heartRate: /(?:hr|heart\s+rate|pulse)\s*:?\s*(\d+)\s*bpm?/gi,
    respiratoryRate: /(?:rr|respiratory\s+rate|resp)\s*:?\s*(\d+)/gi,
    oxygenSaturation: /(?:spo2|o2\s+sat|oxygen\s+saturation)\s*:?\s*(\d+)%/gi
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = pattern.exec(text);
    if (match) {
      if (key === 'bloodPressure') {
        vitals[key] = `${match[1]}/${match[2]}`;
      } else {
        vitals[key] = match[1];
      }
    }
  }

  return vitals;
}

// Helper functions
function normalizeDate(dateStr) {
  // Convert various date formats to ISO format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
}

function extractRoute(text) {
  const routes = ['oral', 'iv', 'im', 'sc', 'topical', 'inhalation'];
  const lowerText = text.toLowerCase();
  for (const route of routes) {
    if (lowerText.includes(route)) {
      return route;
    }
  }
  return null;
}

function determineLabFlag(value, refRange) {
  if (!refRange) return 'normal';
  
  const rangeMatch = refRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    
    if (value < low) return 'low';
    if (value > high) return 'high';
    return 'normal';
  }
  
  return 'normal';
}

/**
 * Main extraction function
 * @param {string} text - Extracted text from PDF
 * @returns {Object} - Structured medical data
 */
function extractMedicalData(text) {
  try {
    logger.info('Starting medical data extraction');
    
    const result = {
      patient: extractPatientInfo(text),
      medications: extractMedications(text),
      diagnoses: extractDiagnoses(text),
      labs: extractLabResults(text),
      vitals: extractVitals(text),
      extraction_timestamp: new Date().toISOString(),
      confidence_overall: 0.75
    };
    
    logger.info(`Medical extraction completed. Found: ${result.medications.length} medications, ${result.labs.length} labs, ${result.diagnoses.length} diagnoses`);
    
    return result;
    
  } catch (error) {
    logger.error('Medical data extraction error:', error);
    throw new Error('Failed to extract medical data');
  }
}

module.exports = {
  extractMedicalData,
  extractPatientInfo,
  extractMedications,
  extractLabResults,
  extractDiagnoses,
  extractVitals
};
