const fs = require('fs-extra');
const path = require('path');
const { extractMedicalData } = require('../utils/medicalExtraction');

// Simple test for medical data extraction
async function testMedicalExtraction() {
  console.log('Testing medical data extraction...');
  
  const sampleText = `
    Patient: John Doe
    DOB: 01/15/1980
    Sex: Male
    MRN: 12345678
    
    Medications:
    - Amoxicillin 500mg TID for 7 days
    - Lisinopril 10mg daily
    
    Lab Results:
    - Hb: 12.5 g/dL (12-16)
    - WBC: 8.2 K/uL (4.0-11.0)
    - Glucose: 95 mg/dL (70-100)
    
    Diagnosis: Upper respiratory tract infection
    
    Vitals:
    - Temperature: 98.6°F
    - Blood Pressure: 120/80
    - Heart Rate: 72 bpm
  `;
  
  try {
    const result = extractMedicalData(sampleText);
    console.log('Extraction successful!');
    console.log('Patient:', result.patient);
    console.log('Medications:', result.medications.length);
    console.log('Labs:', result.labs.length);
    console.log('Diagnoses:', result.diagnoses.length);
    console.log('Vitals:', result.vitals);
    
    return true;
  } catch (error) {
    console.error('Extraction failed:', error);
    return false;
  }
}

// Run test
if (require.main === module) {
  testMedicalExtraction().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testMedicalExtraction };
