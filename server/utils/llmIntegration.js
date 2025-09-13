const OpenAI = require('openai');
const axios = require('axios');
const logger = require('./logger');
const config = require('../config');

/**
 * Initialize OpenAI client
 */
function getOpenAIClient() {
  if (!config.llm.openai.enabled) {
    throw new Error('OpenAI is not configured');
  }
  
  return new OpenAI({
    apiKey: config.llm.openai.apiKey,
  });
}

/**
 * Call OpenAI API for medical analysis
 * @param {string} extractedText - Text extracted from PDF
 * @param {Object} baselineData - Baseline structured data
 * @returns {Promise<Object>} - LLM analysis result
 */
async function analyzeWithOpenAI(extractedText, baselineData) {
  try {
    if (!config.security.allowExternalPHI) {
      throw new Error('External PHI processing is disabled');
    }

    const client = getOpenAIClient();
    
    const systemPrompt = `SYSTEM: You are a cautious medical document analyst assistant. Produce ONLY JSON that conforms to the schema described below. Use conservative language. Do NOT invent patient identifiers or new test results. If uncertain, set fields to null and include a short \`notes\` array explaining ambiguity. NEVER GIVE DEFINITIVE MEDICAL ADVICE. Mark urgent items with "urgency": "urgent" when there is explicit danger language (e.g., "call ambulance", "severe", "shortness of breath", "chest pain").

Output schema keys: patient, medications, diagnoses, labs, impression, recommendations, confidence_overall, source_pages, timestamps, notes.`;

    const userPrompt = `USER: Below is the extracted text from a PDF (preserve formatting and page breaks). Also supply baseline deterministic extractions as \`baseline\`. Use the content to produce structured JSON per the SYSTEM instructions.

EXTRACTED_TEXT:
---START---
${extractedText}
---END---

BASELINE:
${JSON.stringify(baselineData, null, 2)}

TASK:

1. Return JSON that populates patient, medications, diagnoses, labs, impression, recommendations, confidence_overall, source_pages, timestamps.
2. For each medication, include raw_text, standardized name if possible, dose, frequency, route, duration.
3. For labs, include flags (low/high/normal).
4. Keep \`impression\` short (1-3 sentences) and include confidence.
5. Return a plain-language summary under \`patient_summary\` (<= 200 words), with a clear "This is not medical advice" closing line.
6. If ambiguous, add \`notes\` entries describing what is ambiguous and what follow-up question to ask the user.`;

    logger.info('Calling OpenAI API for medical analysis');
    
    const response = await client.chat.completions.create({
      model: config.llm.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);
    
    // Add metadata
    result.llm_provider = 'openai';
    result.llm_model = config.llm.openai.model;
    result.analysis_timestamp = new Date().toISOString();
    
    logger.info('OpenAI analysis completed successfully');
    return result;
    
  } catch (error) {
    logger.error('OpenAI analysis error:', error);
    throw new Error('Failed to analyze with OpenAI');
  }
}

/**
 * Call local Llama API for medical analysis
 * @param {string} extractedText - Text extracted from PDF
 * @param {Object} baselineData - Baseline structured data
 * @returns {Promise<Object>} - LLM analysis result
 */
async function analyzeWithLlama(extractedText, baselineData) {
  try {
    if (!config.llm.llama.enabled) {
      throw new Error('Llama is not configured');
    }

    const systemPrompt = `SYSTEM: You are a cautious medical document analyst assistant. Produce ONLY JSON that conforms to the schema described below. Use conservative language. Do NOT invent patient identifiers or new test results. If uncertain, set fields to null and include a short \`notes\` array explaining ambiguity. NEVER GIVE DEFINITIVE MEDICAL ADVICE. Mark urgent items with "urgency": "urgent" when there is explicit danger language (e.g., "call ambulance", "severe", "shortness of breath", "chest pain").

Output schema keys: patient, medications, diagnoses, labs, impression, recommendations, confidence_overall, source_pages, timestamps, notes.`;

    const userPrompt = `USER: Below is the extracted text from a PDF (preserve formatting and page breaks). Also supply baseline deterministic extractions as \`baseline\`. Use the content to produce structured JSON per the SYSTEM instructions.

EXTRACTED_TEXT:
---START---
${extractedText}
---END---

BASELINE:
${JSON.stringify(baselineData, null, 2)}

TASK:

1. Return JSON that populates patient, medications, diagnoses, labs, impression, recommendations, confidence_overall, source_pages, timestamps.
2. For each medication, include raw_text, standardized name if possible, dose, frequency, route, duration.
3. For labs, include flags (low/high/normal).
4. Keep \`impression\` short (1-3 sentences) and include confidence.
5. Return a plain-language summary under \`patient_summary\` (<= 200 words), with a clear "This is not medical advice" closing line.
6. If ambiguous, add \`notes\` entries describing what is ambiguous and what follow-up question to ask the user.`;

    logger.info('Calling Llama API for medical analysis');
    
    const response = await axios.post(`${config.llm.llama.apiUrl}/api/generate`, {
      model: config.llm.llama.model,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 2000
      }
    });

    const content = response.data.response;
    
    // Try to extract JSON from the response
    let result;
    try {
      // Look for JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.error('Failed to parse Llama response as JSON:', parseError);
      // Fallback: create a basic structure
      result = {
        patient: baselineData.patient || {},
        medications: baselineData.medications || [],
        diagnoses: baselineData.diagnoses || [],
        labs: baselineData.labs || [],
        impression: "Analysis completed using local LLM. Please review results carefully.",
        recommendations: [],
        confidence_overall: 0.6,
        notes: ["LLM response could not be parsed as JSON. Using baseline extraction."],
        patient_summary: "Your medical document has been processed. Please consult with a healthcare provider for proper interpretation of these results. This is not medical advice."
      };
    }
    
    // Add metadata
    result.llm_provider = 'llama';
    result.llm_model = config.llm.llama.model;
    result.analysis_timestamp = new Date().toISOString();
    
    logger.info('Llama analysis completed successfully');
    return result;
    
  } catch (error) {
    logger.error('Llama analysis error:', error);
    throw new Error('Failed to analyze with Llama');
  }
}

/**
 * Main LLM analysis function
 * @param {string} extractedText - Text extracted from PDF
 * @param {Object} baselineData - Baseline structured data
 * @param {string} provider - LLM provider ('openai' or 'llama')
 * @returns {Promise<Object>} - Analysis result
 */
async function analyzeWithLLM(extractedText, baselineData, provider = 'openai') {
  try {
    logger.info(`Starting LLM analysis with provider: ${provider}`);
    
    let result;
    
    switch (provider.toLowerCase()) {
      case 'openai':
        result = await analyzeWithOpenAI(extractedText, baselineData);
        break;
      case 'llama':
        result = await analyzeWithLlama(extractedText, baselineData);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
    
    // Validate and sanitize the result
    result = validateAndSanitizeResult(result, baselineData);
    
    logger.info('LLM analysis completed successfully');
    return result;
    
  } catch (error) {
    logger.error('LLM analysis failed:', error);
    
    // Return baseline data with error note
    return {
      ...baselineData,
      impression: "LLM analysis failed. Results based on rule-based extraction only.",
      recommendations: [],
      confidence_overall: 0.5,
      notes: [`LLM analysis failed: ${error.message}`],
      patient_summary: "Your medical document has been processed using basic extraction methods. Please consult with a healthcare provider for proper interpretation. This is not medical advice.",
      llm_provider: provider,
      analysis_timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Validate and sanitize LLM result
 * @param {Object} result - LLM analysis result
 * @param {Object} baselineData - Baseline data for validation
 * @returns {Object} - Sanitized result
 */
function validateAndSanitizeResult(result, baselineData) {
  // Ensure required fields exist
  const sanitized = {
    patient: result.patient || baselineData.patient || {},
    medications: result.medications || baselineData.medications || [],
    diagnoses: result.diagnoses || baselineData.diagnoses || [],
    labs: result.labs || baselineData.labs || [],
    impression: result.impression || "No clinical impression available.",
    recommendations: result.recommendations || [],
    confidence_overall: Math.min(Math.max(result.confidence_overall || 0.5, 0), 1),
    source_pages: result.source_pages || [],
    timestamps: result.timestamps || {},
    notes: result.notes || [],
    patient_summary: result.patient_summary || "Your medical document has been processed. Please consult with a healthcare provider for proper interpretation. This is not medical advice.",
    ...result
  };
  
  // Validate confidence scores
  if (sanitized.medications) {
    sanitized.medications = sanitized.medications.map(med => ({
      ...med,
      confidence: Math.min(Math.max(med.confidence || 0.5, 0), 1)
    }));
  }
  
  if (sanitized.labs) {
    sanitized.labs = sanitized.labs.map(lab => ({
      ...lab,
      confidence: Math.min(Math.max(lab.confidence || 0.5, 0), 1)
    }));
  }
  
  if (sanitized.diagnoses) {
    sanitized.diagnoses = sanitized.diagnoses.map(dx => ({
      ...dx,
      confidence: Math.min(Math.max(dx.confidence || 0.5, 0), 1)
    }));
  }
  
  return sanitized;
}

module.exports = {
  analyzeWithLLM,
  analyzeWithOpenAI,
  analyzeWithLlama,
  validateAndSanitizeResult
};
