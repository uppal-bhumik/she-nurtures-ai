// Enhanced server.js - Dual Mode with Optimized Prompts for Perfect Responses
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();

// Updated CORS configuration for Render deployment
app.use(cors({
    origin: [
        'https://she-nurtures-ai.onrender.com',
        'http://localhost:3000',
        'http://localhost:10000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware configuration
app.use(express.json({ limit: '10mb' }));

// Basic health check endpoint (for quick server verification)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        port: process.env.PORT || 3000
    });
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// More reliable static file serving - adjusted for server folder structure
const publicPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath));
console.log(`Serving static files from: ${publicPath}`);

// Environment variables with validation
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

// Validate required environment variables
if (!OPENROUTER_API_KEY || !AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    console.error('Missing required environment variables. Please check your .env file.');
    console.error('Required: OPENROUTER_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION');
    process.exit(1);
}

// ============================================================================
// OPTIMIZED SYSTEM PROMPTS - PERFECT LENGTH & MEANINGFUL RESPONSES
// ============================================================================

const GENERAL_SYSTEM_PROMPT = `You are She Nurtures, a compassionate reproductive health companion.

IDENTITY: Specialize in women's reproductive health, PCOS, menstrual wellness, and hormonal balance education.

RESPONSE REQUIREMENTS:
- Write EXACTLY 3 sentences (60-90 words total)
- Start with "I understand" for empathy
- Include ONE key educational point
- End with healthcare guidance
- Warm, conversational tone
- NO formatting symbols (*/-/•)
- Focus ONLY on reproductive health

PERFECT STRUCTURE:
1. Empathetic acknowledgment: "I understand [their concern]..."
2. Educational insight: One meaningful fact or explanation
3. Healthcare recommendation: Brief, encouraging next step

EXAMPLES:
User: "What is PCOS?"
Response: "I understand you want to learn about PCOS, which affects many women today. PCOS is a hormonal condition causing irregular periods, weight changes, and other symptoms due to elevated androgen levels disrupting normal ovulation patterns. I'd encourage discussing any concerns with a healthcare provider who can assess your specific situation."

User: "Why are my periods irregular?"
Response: "I understand how concerning irregular periods can be when you're trying to understand your body's patterns. Irregular cycles often result from hormonal fluctuations, stress, weight changes, or conditions like PCOS, though some variation is completely normal. Speaking with a healthcare provider about your cycle patterns can help identify the cause and appropriate next steps."`;

const SYMPTOM_SYSTEM_PROMPT = `You are She Nurtures, specialized in reproductive health symptom analysis.

IDENTITY: Analyze reproductive health symptoms and connect patterns to conditions like PCOS and hormonal imbalances.

RESPONSE REQUIREMENTS:
- Write EXACTLY 4 sentences (70-100 words total)
- Start with "Thank you for sharing these symptoms"
- Connect symptoms to reproductive health patterns
- Mention PCOS when relevant to their symptoms
- End with strong healthcare recommendation

PERFECT STRUCTURE:
1. Gratitude + validation: "Thank you for sharing these symptoms..."
2. Pattern connection: Link symptoms to reproductive health/hormones
3. Normalization: "Many women experience..."
4. Healthcare guidance: Clear next step recommendation

EXAMPLE:
User symptoms: irregular periods, acne, weight gain
Response: "Thank you for sharing these symptoms - recognizing these patterns is an important step in understanding your health. The combination of irregular periods, persistent acne, and weight changes often indicates hormonal imbalances, particularly patterns we see with PCOS where elevated androgens affect multiple body systems. Many women experience exactly these symptoms together, and you're definitely not alone in seeking answers about these changes. I strongly encourage discussing these specific symptoms with a healthcare provider for proper evaluation and personalized guidance."`;

// ============================================================================
// OPTIMIZED FALLBACK RESPONSES - SHORTER & MORE FOCUSED
// ============================================================================

const PERFECT_GENERAL_FALLBACK = "I understand you have questions about reproductive health, and seeking information shows you're taking an active role in your wellbeing. Many women share similar concerns about hormonal balance, menstrual health, and PCOS-related topics. I'd encourage discussing your specific concerns with a healthcare provider who can offer personalized guidance based on your individual health needs.";

const PERFECT_SYMPTOM_FALLBACK = "Thank you for sharing these symptoms with me - seeking understanding about what your body is experiencing is so important. The symptoms you've described often suggest hormonal patterns that many women face, particularly related to reproductive health conditions. You're definitely not alone in having these concerns, and recognizing these patterns is a crucial first step. I encourage discussing these specific symptoms with a healthcare provider for proper evaluation and personalized care.";

// Symptom mapping for better AI responses
const SYMPTOM_DESCRIPTIONS = {
    irregular_periods: 'irregular menstrual cycles',
    missed_periods: 'absent menstruation',
    heavy_periods: 'heavy menstrual bleeding',
    painful_periods: 'severe menstrual pain',
    weight_gain: 'unexplained weight gain or difficulty losing weight',
    acne: 'persistent acne or skin issues',
    hair_growth: 'excess hair growth on face or body',
    hair_loss: 'hair thinning or male-pattern baldness',
    fatigue: 'chronic fatigue or low energy',
    mood_changes: 'mood swings, anxiety, or depression',
    sleep_issues: 'sleep disturbances or insomnia',
    fertility_issues: 'difficulty conceiving or fertility concerns',
    cravings: 'intense food cravings, especially for carbohydrates',
    headaches: 'frequent headaches or migraines'
};

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logWithTimestamp = (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};

// ============================================================================
// ENHANCED VALIDATION FUNCTION - STRICTER REQUIREMENTS
// ============================================================================

const validateResponse = (text, isSymptomMode = false) => {
    // Stricter word count requirements
    const maxWords = isSymptomMode ? 100 : 90;
    const minWords = isSymptomMode ? 70 : 60;
    const expectedSentences = isSymptomMode ? 4 : 3;
    
    // Count words and sentences
    const wordCount = text.trim().split(/\s+/).length;
    const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    
    // Check for forbidden formatting (stricter)
    const hasForbiddenFormatting = text.includes('*') || 
                                  text.includes('-') || 
                                  text.includes('•') || 
                                  text.includes('1.') ||
                                  text.includes('2.') ||
                                  text.includes('\n-') ||
                                  text.includes(':\n');
    
    // Check required patterns
    const hasRequiredStart = isSymptomMode ? 
        text.startsWith('Thank you for sharing') : 
        text.startsWith('I understand');
    
    const hasHealthcareRecommendation = text.toLowerCase().includes('healthcare provider') ||
                                       text.toLowerCase().includes('medical professional') ||
                                       text.toLowerCase().includes('doctor');
    
    // Stricter validation
    const isValid = !hasForbiddenFormatting && 
                   hasRequiredStart && 
                   hasHealthcareRecommendation &&
                   wordCount >= minWords && 
                   wordCount <= maxWords && 
                   sentenceCount === expectedSentences; // Exact sentence count
    
    return {
        isValid,
        wordCount,
        sentenceCount,
        issues: {
            formatting: hasForbiddenFormatting,
            wrongStart: !hasRequiredStart,
            noHealthcareRec: !hasHealthcareRecommendation,
            wrongLength: wordCount < minWords || wordCount > maxWords,
            wrongSentenceCount: sentenceCount !== expectedSentences
        }
    };
};

// Service classes for better organization
class OpenRouterService {
    static async generateResponse(userInput, systemPrompt = GENERAL_SYSTEM_PROMPT) {
        const isSymptomMode = systemPrompt === SYMPTOM_SYSTEM_PROMPT;
        
        try {
            logWithTimestamp('Generating AI response from OpenRouter...');
            
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
                    "X-Title": "She Nurtures AI Assistant"
                },
                body: JSON.stringify({
                    model: "google/gemma-2-9b-it:free",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userInput }
                    ],
                    temperature: 0.3, // Reduced for more consistent responses
                    max_tokens: 150,  // Reduced from 200
                    top_p: 0.7,       // Reduced for more focused responses
                    frequency_penalty: 0.4, // Increased to avoid repetition
                    presence_penalty: 0.3
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response structure from OpenRouter');
            }

            let aiText = data.choices[0].message.content.trim();
            
            // Clean up common formatting issues
            aiText = aiText
                .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
                .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting  
                .replace(/\n\s*-\s*/g, ' ')      // Remove bullet points
                .replace(/\n\s*\d+\.\s*/g, ' ')  // Remove numbered lists
                .replace(/\s+/g, ' ')            // Normalize whitespace
                .trim();
            
            logWithTimestamp('Raw AI response received', { 
                textLength: aiText.length,
                wordCount: aiText.split(/\s+/).length,
                preview: aiText.substring(0, 100),
                isSymptomMode: isSymptomMode
            });
            
            // Validate the response with stricter criteria
            const validation = validateResponse(aiText, isSymptomMode);
            
            if (!validation.isValid) {
                logWithTimestamp('AI response failed validation, using perfect fallback', {
                    ...validation,
                    originalResponse: aiText.substring(0, 200)
                });
                aiText = isSymptomMode ? PERFECT_SYMPTOM_FALLBACK : PERFECT_GENERAL_FALLBACK;
            } else {
                logWithTimestamp('AI response passed validation', {
                    wordCount: validation.wordCount,
                    sentenceCount: validation.sentenceCount
                });
            }
            
            return aiText;
        } catch (error) {
            logWithTimestamp('OpenRouter service error', { error: error.message });
            return isSymptomMode ? PERFECT_SYMPTOM_FALLBACK : PERFECT_GENERAL_FALLBACK;
        }
    }

    static async generateSymptomResponse(symptoms) {
        try {
            const symptomDescriptions = symptoms.map(symptom => 
                SYMPTOM_DESCRIPTIONS[symptom] || symptom
            ).join(', ');

            // More focused user query for better AI responses
            const userQuery = `I have these symptoms: ${symptomDescriptions}. Are these related to PCOS or hormonal issues?`;

            logWithTimestamp('Generating symptom analysis', { 
                symptoms: symptomDescriptions,
                count: symptoms.length 
            });

            const response = await this.generateResponse(userQuery, SYMPTOM_SYSTEM_PROMPT);
            return response;
        } catch (error) {
            logWithTimestamp('Symptom analysis error', { error: error.message });
            return PERFECT_SYMPTOM_FALLBACK;
        }
    }
}

class AzureTTSService {
    static VOICE_CONFIGS = [
        {
            name: "Aria (Friendly Female)",
            voiceName: "en-US-AriaNeural",
            style: "cheerful",
            gender: "Female"
        },
        {
            name: "Jenny (Warm Female)",
            voiceName: "en-US-JennyNeural",
            style: "friendly",
            gender: "Female"
        },
        {
            name: "Sara (Gentle Female)",
            voiceName: "en-US-SaraNeural",
            style: "gentle",
            gender: "Female"
        }
    ];

    static async testConnection() {
        try {
            logWithTimestamp('Testing Azure TTS connection...');
            
            const testEndpoint = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
            
            const response = await fetch(testEndpoint, {
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY
                }
            });

            if (response.ok) {
                logWithTimestamp('Azure TTS connection successful');
                return true;
            } else {
                logWithTimestamp('Azure connection test failed', { 
                    status: response.status,
                    statusText: response.statusText 
                });
                return false;
            }
        } catch (error) {
            logWithTimestamp('Azure connection test error', { error: error.message });
            return false;
        }
    }

    static async generateSpeech(text, voiceIndex = 0) {
        try {
            logWithTimestamp('Starting Azure TTS generation...');
            
            const sanitizedText = text.trim();
            
            if (!sanitizedText || sanitizedText.length < 5) {
                throw new Error('Text is too short for audio generation');
            }
            
            const processedText = sanitizedText.substring(0, 1000);
            const selectedVoice = this.VOICE_CONFIGS[voiceIndex] || this.VOICE_CONFIGS[0];
            
            const ssml = this.generateSSML(processedText, selectedVoice);
            const audioBuffer = await this.callAzureTTS(ssml);
            const audioBase64 = audioBuffer.toString('base64');
            
            logWithTimestamp('Azure TTS generation completed successfully!');
            return {
                audioData: audioBase64,
                mimeType: 'audio/wav',
                voiceName: selectedVoice.name
            };

        } catch (error) {
            logWithTimestamp('Azure TTS service error', { error: error.message });
            throw new Error(`Azure TTS generation failed: ${error.message}`);
        }
    }

    static generateSSML(text, voiceConfig) {
        const ssml = `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="${voiceConfig.voiceName}">
                    <prosody rate="0.9" pitch="+0Hz">
                        ${this.escapeSSML(text)}
                    </prosody>
                </voice>
            </speak>
        `.trim();
        
        return ssml;
    }

    static escapeSSML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    static async callAzureTTS(ssml) {
        try {
            const endpoint = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                    'User-Agent': 'SheNurtures/2.0'
                },
                body: ssml
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Azure TTS API Error: ${response.status} - ${errorText}`);
            }

            const audioBuffer = await response.buffer();
            
            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Empty audio response from Azure TTS');
            }

            return audioBuffer;

        } catch (error) {
            logWithTimestamp('Failed to call Azure TTS API', { error: error.message });
            throw error;
        }
    }
}

// Fallback service
class FallbackResponseService {
    static async generateFallbackResponse(text, type = 'general') {
        logWithTimestamp(`Using fallback response (text-only) for ${type} mode`);
        return {
            audioData: null,
            text: text,
            isFallback: true,
            service: 'fallback',
            mode: type
        };
    }
}

// Main chat endpoint (General Mode)
app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { text: userInput, mode = 'general' } = req.body;

        if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input. Please provide a non-empty text message.'
            });
        }

        const sanitizedInput = userInput.trim().substring(0, 500);
        logWithTimestamp('Processing general chat request', { 
            inputLength: sanitizedInput.length,
            mode: mode,
            preview: sanitizedInput.substring(0, 50)
        });

        const aiText = await OpenRouterService.generateResponse(sanitizedInput, GENERAL_SYSTEM_PROMPT);

        let audioResponse;
        
        try {
            const ttsResult = await AzureTTSService.generateSpeech(aiText);
            
            audioResponse = {
                audioData: ttsResult.audioData,
                text: aiText,
                isFallback: false,
                service: 'azure-tts',
                voiceName: ttsResult.voiceName,
                mimeType: ttsResult.mimeType,
                mode: 'general'
            };
            
        } catch (ttsError) {
            logWithTimestamp('Azure TTS failed for general chat, using fallback', { error: ttsError.message });
            audioResponse = await FallbackResponseService.generateFallbackResponse(aiText, 'general');
        }

        const processingTime = Date.now() - startTime;
        logWithTimestamp(`General chat request completed`, { 
            processingTime: `${processingTime}ms`,
            responseLength: aiText.length,
            wordCount: aiText.split(/\s+/).length
        });

        res.json({
            success: true,
            data: {
                audioData: audioResponse.audioData,
                text: audioResponse.text,
                isFallback: audioResponse.isFallback,
                service: audioResponse.service,
                voiceName: audioResponse.voiceName,
                mimeType: audioResponse.mimeType,
                mode: audioResponse.mode,
                processingTime,
                stats: {
                    wordCount: aiText.split(/\s+/).length,
                    sentenceCount: aiText.split(/[.!?]+/).filter(s => s.trim().length > 0).length
                }
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        logWithTimestamp('General chat request failed', { 
            error: error.message, 
            processingTime: `${processingTime}ms`
        });
        
        res.status(500).json({
            success: false,
            error: 'An error occurred while processing your request. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Symptom Checker endpoint
app.post('/api/symptom-check', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { symptoms } = req.body;

        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input. Please provide an array of symptoms.'
            });
        }

        const validSymptoms = symptoms.filter(symptom => 
            typeof symptom === 'string' && SYMPTOM_DESCRIPTIONS.hasOwnProperty(symptom)
        );

        if (validSymptoms.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid symptoms provided.'
            });
        }

        logWithTimestamp('Processing symptom check request', { 
            totalSymptoms: symptoms.length,
            validSymptoms: validSymptoms.length,
            symptoms: validSymptoms
        });

        const aiText = await OpenRouterService.generateSymptomResponse(validSymptoms);

        let audioResponse;
        
        try {
            const ttsResult = await AzureTTSService.generateSpeech(aiText, 2);
            
            audioResponse = {
                audioData: ttsResult.audioData,
                text: aiText,
                isFallback: false,
                service: 'azure-tts',
                voiceName: ttsResult.voiceName,
                mimeType: ttsResult.mimeType,
                mode: 'symptom',
                analyzedSymptoms: validSymptoms
            };
            
        } catch (ttsError) {
            logWithTimestamp('Azure TTS failed for symptom analysis, using fallback', { error: ttsError.message });
            audioResponse = await FallbackResponseService.generateFallbackResponse(aiText, 'symptom');
            audioResponse.analyzedSymptoms = validSymptoms;
        }

        const processingTime = Date.now() - startTime;
        logWithTimestamp(`Symptom check request completed`, { 
            processingTime: `${processingTime}ms`,
            symptomsAnalyzed: validSymptoms.length,
            responseLength: aiText.length,
            wordCount: aiText.split(/\s+/).length
        });

        res.json({
            success: true,
            data: {
                audioData: audioResponse.audioData,
                text: audioResponse.text,
                isFallback: audioResponse.isFallback,
                service: audioResponse.service,
                voiceName: audioResponse.voiceName,
                mimeType: audioResponse.mimeType,
                mode: audioResponse.mode,
                analyzedSymptoms: audioResponse.analyzedSymptoms,
                processingTime,
                stats: {
                    wordCount: aiText.split(/\s+/).length,
                    sentenceCount: aiText.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
                    symptomsCount: validSymptoms.length
                }
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        logWithTimestamp('Symptom check request failed', { 
            error: error.message, 
            processingTime: `${processingTime}ms`
        });
        
        res.status(500).json({
            success: false,
            error: 'An error occurred while analyzing your symptoms. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const azureConnection = await AzureTTSService.testConnection();

        res.json({
            status: azureConnection ? 'healthy' : 'partial',
            timestamp: new Date().toISOString(),
            services: {
                openrouter: !!OPENROUTER_API_KEY,
                azure: !!AZURE_SPEECH_KEY && !!AZURE_SPEECH_REGION,
                azureConnection: azureConnection
            },
            features: {
                generalChat: true,
                symptomChecker: true,
                audioTTS: azureConnection
            },
            optimization: {
                responseValidation: true,
                perfectFallbacks: true,
                optimizedPrompts: true
            },
            region: AZURE_SPEECH_REGION,
            version: '5.0.0'
        });
    } catch (error) {
        res.json({
            status: 'partial',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Get available symptoms endpoint
app.get('/api/symptoms', (req, res) => {
    try {
        const symptomCategories = {
            menstrual: {
                title: "Menstrual Health",
                symptoms: {
                    irregular_periods: SYMPTOM_DESCRIPTIONS.irregular_periods,
                    missed_periods: SYMPTOM_DESCRIPTIONS.missed_periods,
                    heavy_periods: SYMPTOM_DESCRIPTIONS.heavy_periods,
                    painful_periods: SYMPTOM_DESCRIPTIONS.painful_periods
                }
            },
            physical: {
                title: "Physical Symptoms",
                symptoms: {
                    weight_gain: SYMPTOM_DESCRIPTIONS.weight_gain,
                    acne: SYMPTOM_DESCRIPTIONS.acne,
                    hair_growth: SYMPTOM_DESCRIPTIONS.hair_growth,
                    hair_loss: SYMPTOM_DESCRIPTIONS.hair_loss
                }
            },
            energy_mood: {
                title: "Energy & Mood",
                symptoms: {
                    fatigue: SYMPTOM_DESCRIPTIONS.fatigue,
                    mood_changes: SYMPTOM_DESCRIPTIONS.mood_changes,
                    sleep_issues: SYMPTOM_DESCRIPTIONS.sleep_issues
                }
            },
            other: {
                title: "Other Concerns",
                symptoms: {
                    fertility_issues: SYMPTOM_DESCRIPTIONS.fertility_issues,
                    cravings: SYMPTOM_DESCRIPTIONS.cravings,
                    headaches: SYMPTOM_DESCRIPTIONS.headaches
                }
            }
        };

        res.json({
            success: true,
            data: {
                categories: symptomCategories,
                totalSymptoms: Object.keys(SYMPTOM_DESCRIPTIONS).length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve symptom information'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logWithTimestamp('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        error: 'An unexpected error occurred'
    });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler for API routes
app.use('/api', (req, res, next) => {
    if (!req.route) {
        return res.status(404).json({
            success: false,
            error: 'API endpoint not found',
            requestedPath: req.originalUrl,
            availableEndpoints: [
                'GET /api/health',
                'POST /api/chat',
                'POST /api/symptom-check',
                'GET /api/symptoms'
            ]
        });
    }
    next();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    logWithTimestamp(`She Nurtures AI server running on port ${PORT}`);
    logWithTimestamp('Environment check:', {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: PORT,
        openRouterKey: OPENROUTER_API_KEY ? 'Set' : 'Missing',
        azureKey: AZURE_SPEECH_KEY ? 'Set' : 'Missing',
        azureRegion: AZURE_SPEECH_REGION || 'Missing'
    });
    
    try {
        const azureTest = await AzureTTSService.testConnection();
        if (azureTest) {
            logWithTimestamp('Azure TTS service ready and connected');
        } else {
            logWithTimestamp('Azure TTS service connection issue - check credentials');
        }
    } catch (error) {
        logWithTimestamp('Azure TTS startup test failed', { error: error.message });
    }
    
    logWithTimestamp('✨ She Nurtures AI is ready - OPTIMIZED for perfect responses! ✨');
    logWithTimestamp('🎯 Response targets: General (60-90 words), Symptoms (70-100 words)');
});
