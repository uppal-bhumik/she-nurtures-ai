// Enhanced server.js - Dual Mode with Symptom Checker and Azure TTS
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
    console.error('⚠️ Missing required environment variables. Please check your .env file.');
    console.error('Required: OPENROUTER_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION');
    process.exit(1);
}

// ============================================================================
// BULLETPROOF SYSTEM PROMPTS - MAXIMUM RELIABILITY & CONSISTENCY
// ============================================================================

const GENERAL_SYSTEM_PROMPT = `YOU ARE SHE NURTURES. YOU MUST RESPOND AS SHE NURTURES TO EVERY MESSAGE.

IDENTITY: You are She Nurtures, a warm reproductive health education companion. You ONLY discuss women's health, PCOS, PCOD, menstrual health, and reproductive wellness.

MANDATORY RESPONSE FORMAT - EXACTLY 2 SENTENCES:
Sentence 1: "I understand [acknowledge their concern]. [One key educational point about reproductive health]."
Sentence 2: "I'd encourage you to speak with a healthcare provider for personalized guidance."

CRITICAL RULES:
- EXACTLY 2 sentences total
- NEVER exceed 60 words
- NEVER use asterisks, bullets, or formatting
- Start with "I understand"
- End with healthcare provider recommendation
- Stay focused on reproductive health only

EXAMPLE RESPONSES (COPY THIS EXACT LENGTH AND STYLE):
User: "What is PCOS?"
She Nurtures: "I understand you want to learn about PCOS, which is a common hormonal condition that can cause irregular periods, skin changes, and weight fluctuations in many women. I'd encourage you to speak with a healthcare provider for personalized guidance about PCOS and your specific situation."

User: "Are irregular periods normal?"
She Nurtures: "I understand how concerning irregular cycles can be, and while some variation is normal, persistent changes often relate to stress, hormones, or conditions like PCOS. I'd encourage you to speak with a healthcare provider for personalized guidance about your menstrual patterns."

WORD LIMIT: Maximum 60 words total. Count your words carefully.`;

const SYMPTOM_SYSTEM_PROMPT = `YOU ARE SHE NURTURES ANALYZING REPRODUCTIVE HEALTH SYMPTOMS.

IDENTITY: You analyze symptoms and connect them to reproductive health patterns. You MUST be brief and focused.

MANDATORY RESPONSE FORMAT - EXACTLY 3 SENTENCES:
Sentence 1: "Thank you for sharing these symptoms - [brief validation]."
Sentence 2: "These symptoms often suggest [hormonal/PCOS connection in simple terms]."
Sentence 3: "Please discuss these specific symptoms with a healthcare provider for proper evaluation."

CRITICAL RULES:
- EXACTLY 3 sentences total
- NEVER exceed 50 words
- Always connect symptoms to PCOS/hormonal patterns
- Be specific about the symptoms they selected
- No long explanations - keep it concise

EXAMPLE RESPONSE (COPY THIS EXACT LENGTH):
"Thank you for sharing these symptoms - I understand your concerns about these changes. These symptoms often suggest hormonal imbalances commonly seen in PCOS where irregular periods and skin issues appear together. Please discuss these specific symptoms with a healthcare provider for proper evaluation."

WORD LIMIT: Maximum 50 words total. Be concise and direct.`;

// ============================================================================
// REST OF THE APPLICATION REMAINS UNCHANGED
// ============================================================================

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

// Service classes for better organization
class OpenRouterService {
    static async generateResponse(userInput, systemPrompt = GENERAL_SYSTEM_PROMPT) {
        try {
            logWithTimestamp('🤖 Generating AI response from OpenRouter...');
            
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
                    temperature: 0.3,  // Much lower for consistency
                    max_tokens: 250,
                    top_p: 0.8,        // More focused
                    frequency_penalty: 0.3,  // Penalize repetition
                    presence_penalty: 0.2    // Encourage staying on topic
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

            let aiText = data.choices[0].message.content;
            
            // Log the raw AI response for debugging
            logWithTimestamp('📋 Raw AI response received', { 
                textLength: aiText.length,
                preview: aiText.substring(0, 100),
                fullText: aiText 
            });
            
            // Enhanced quality validation - Check for off-topic responses
            const offTopicIndicators = [
                'creative and informative',
                'great challenge',
                'more specific instructions',
                'what topic should',
                'what style should',
                'tailor my response',
                'work together',
                'I can help you',
                'let me know what you need'
            ];
            
            const isOffTopic = offTopicIndicators.some(indicator => 
                aiText.toLowerCase().includes(indicator.toLowerCase())
            );
            
            if (isOffTopic) {
                logWithTimestamp('🚨 AI went completely off-topic, using emergency fallback');
                aiText = systemPrompt === SYMPTOM_SYSTEM_PROMPT 
                    ? "Thank you for sharing these symptoms - I understand your concerns. These symptoms often suggest hormonal imbalances commonly seen in PCOS. Please discuss these specific symptoms with a healthcare provider for proper evaluation."
                    : "I understand your concerns about reproductive health, and these are important questions many women have. I'd encourage you to speak with a healthcare provider for personalized guidance.";
            }
            
            // Length validation - enforce brevity
            const wordCount = aiText.split(' ').length;
            const maxWords = systemPrompt === SYMPTOM_SYSTEM_PROMPT ? 50 : 60;
            
            if (wordCount > maxWords) {
                logWithTimestamp(`⚠️ Response too long (${wordCount} words), truncating`);
                const words = aiText.split(' ');
                aiText = words.slice(0, maxWords).join(' ');
                
                // Ensure it ends properly
                if (!aiText.includes('healthcare provider')) {
                    const baseResponse = systemPrompt === SYMPTOM_SYSTEM_PROMPT 
                        ? "Please discuss these symptoms with a healthcare provider for proper evaluation."
                        : "I'd encourage you to speak with a healthcare provider for personalized guidance.";
                    
                    // Find last complete sentence and add proper ending
                    const lastPeriod = aiText.lastIndexOf('.');
                    if (lastPeriod > 0) {
                        aiText = aiText.substring(0, lastPeriod + 1) + " " + baseResponse;
                    } else {
                        aiText = aiText + ". " + baseResponse;
                    }
                }
            }
            
            // Sentence count validation
            const sentenceCount = aiText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
            const maxSentences = systemPrompt === SYMPTOM_SYSTEM_PROMPT ? 3 : 2;
            
            if (sentenceCount > maxSentences) {
                logWithTimestamp(`⚠️ Too many sentences (${sentenceCount}), using fallback`);
                aiText = systemPrompt === SYMPTOM_SYSTEM_PROMPT 
                    ? "Thank you for sharing these symptoms - I understand your concerns. These symptoms often suggest hormonal imbalances commonly seen in PCOS. Please discuss these specific symptoms with a healthcare provider for proper evaluation."
                    : "I understand your concerns about reproductive health, and these are important questions many women have. I'd encourage you to speak with a healthcare provider for personalized guidance.";
            }
            const offTopicIndicators = [
                'creative and informative',
                'great challenge',
                'more specific instructions',
                'what topic should',
                'what style should',
                'tailor my response',
                'work together',
                'I can help you',
                'let me know what you need'
            ];
            
            const isOffTopic = offTopicIndicators.some(indicator => 
                aiText.toLowerCase().includes(indicator.toLowerCase())
            );
            
            if (isOffTopic) {
                logWithTimestamp('🚨 AI went completely off-topic, using emergency fallback');
                aiText = systemPrompt === SYMPTOM_SYSTEM_PROMPT 
                    ? `Thank you for sharing these symptoms with me - I understand how important it is to get clarity about what your body might be experiencing. The symptoms you've described often suggest hormonal patterns that many women face, particularly those related to reproductive health conditions where multiple symptoms can appear together as your body responds to changing hormone levels. You're definitely not alone in having these concerns, and seeking understanding about these patterns is actually a really positive step in taking charge of your health. I encourage you to discuss these specific symptoms with a healthcare provider who can properly evaluate your individual situation and provide personalized guidance.`
                    : `I understand you're seeking information about reproductive health, and that's completely natural when you have concerns about your body. Many women have questions about hormonal balance, menstrual health, PCOS, and other reproductive wellness topics, and having access to educational information can help you feel more empowered. I'd encourage you to discuss your specific concerns with a healthcare provider who can give you personalized guidance based on your individual health needs.`;
            }
            
            // Enhanced quality validation - Check for formatting issues
            if (aiText.includes('**') || aiText.includes('*') || aiText.includes('- ') || aiText.includes('1.') || aiText.includes('•')) {
                logWithTimestamp('⚠️ AI used forbidden formatting, cleaning response');
                aiText = aiText
                    .replace(/\*\*/g, '')  // Remove bold markdown
                    .replace(/\*/g, '')    // Remove italic markdown
                    .replace(/- /g, '')    // Remove bullet points
                    .replace(/\d+\./g, '') // Remove numbered lists
                    .replace(/•/g, '')     // Remove bullet symbols
                    .replace(/\n+/g, ' ')  // Replace line breaks with spaces
                    .replace(/\s+/g, ' ')  // Clean up multiple spaces
                    .trim();
                
                // If cleaning resulted in poor text, use fallback
                if (aiText.length < 50) {
                    logWithTimestamp('⚠️ Cleaned text too short, using fallback');
                    aiText = "I understand you're seeking support with your health concerns, and that's completely natural. Many women have questions about reproductive health, and while I can share general educational information, your specific situation would benefit from a conversation with a healthcare provider. Please don't hesitate to reach out to a medical professional who can give you personalized guidance.";
                }
            }
            
            // Quality check for generic refusals
            const genericRefusalPhrases = [
                "I can't provide medical advice",
                "I am not a doctor",
                "I cannot diagnose",
                "consult a healthcare professional" // if it STARTS with this
            ];
            
            const startsWithRefusal = genericRefusalPhrases.some(phrase => 
                aiText.toLowerCase().trim().startsWith(phrase.toLowerCase())
            );
            
            if (startsWithRefusal) {
                logWithTimestamp('⚠️ AI gave generic refusal, using enhanced response');
                aiText = "I understand you're looking for support with your health concerns. Many women experience similar questions about reproductive health, and it's completely natural to seek understanding. While I can share general educational information, your specific situation would benefit from discussion with a healthcare provider who can offer personalized guidance.";
            }
            
            logWithTimestamp('✅ AI response processed successfully', { finalLength: aiText.length });
            
            return aiText.trim();
        } catch (error) {
            logWithTimestamp('❌ OpenRouter service error', { error: error.message });
            
            // Enhanced fallback response with She Nurtures persona
            const fallbackResponse = "I'm having trouble connecting right now, but I want you to know that your health concerns are valid and important. For questions about reproductive health, PCOS, or PCOD, please reach out to a qualified healthcare provider who can give you the personalized support you deserve. You're not alone in this journey.";
            logWithTimestamp('🔄 Using enhanced fallback AI response');
            return fallbackResponse;
        }
    }

    static async generateSymptomResponse(symptoms) {
        try {
            // Convert symptom codes to readable descriptions
            const symptomDescriptions = symptoms.map(symptom => 
                SYMPTOM_DESCRIPTIONS[symptom] || symptom
            ).join(', ');

            // Enhanced user query specifically designed to get better symptom responses
            const userQuery = `I am experiencing these specific symptoms: ${symptomDescriptions}. I'm concerned about what these might mean for my reproductive health and would really appreciate your help understanding if they could be connected to conditions like PCOS or other hormonal imbalances. I want to understand what my body might be telling me so I can be better prepared when I talk to a healthcare provider. Can you help me understand these symptom patterns?`;

            logWithTimestamp('🔍 Generating symptom analysis', { symptoms: symptomDescriptions });

            // Use the enhanced symptom-specific prompt
            const response = await this.generateResponse(userQuery, SYMPTOM_SYSTEM_PROMPT);
            
            // Additional validation for symptom responses
            if (response.length < 100) {
                logWithTimestamp('⚠️ Symptom response too short, using enhanced fallback');
                return `Thank you for sharing these symptoms with me - I understand how concerning it can be when your body feels different or unpredictable. The combination of ${symptomDescriptions} you're experiencing often suggests hormonal patterns that many women face, particularly those related to conditions like PCOS where multiple symptoms can appear together as your body responds to hormonal changes. You're definitely not alone in experiencing these concerns, and recognizing these patterns is actually an important step in understanding your health. I really encourage you to discuss these specific symptoms with a healthcare provider who can properly evaluate your situation and help you develop a personalized approach to addressing your concerns.`;
            }
            
            return response;
        } catch (error) {
            logWithTimestamp('❌ Symptom analysis error', { error: error.message });
            throw error;
        }
    }
}

class AzureTTSService {
    // Available voice configurations
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
            logWithTimestamp('🔍 Testing Azure TTS connection...');
            
            // Test the voices endpoint
            const testEndpoint = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
            
            const response = await fetch(testEndpoint, {
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY
                }
            });

            if (response.ok) {
                logWithTimestamp('✅ Azure TTS connection successful');
                return true;
            } else if (response.status === 401) {
                logWithTimestamp('❌ Azure authentication failed - check API key');
                return false;
            } else if (response.status === 403) {
                logWithTimestamp('❌ Azure access forbidden - check subscription permissions');
                return false;
            } else {
                logWithTimestamp('⚠️ Azure connection test failed', { 
                    status: response.status,
                    statusText: response.statusText 
                });
                return false;
            }
        } catch (error) {
            logWithTimestamp('⚠️ Azure connection test error', { error: error.message });
            return false;
        }
    }

    static async generateSpeech(text, voiceIndex = 0) {
        try {
            logWithTimestamp('🎤 Starting Azure TTS generation...');
            
            // Sanitize and validate text
            const sanitizedText = text.trim();
            
            // Check for empty or very short text
            if (!sanitizedText || sanitizedText.length < 5) {
                logWithTimestamp('⚠️ Text too short for TTS generation', { 
                    originalLength: text.length,
                    sanitizedLength: sanitizedText.length,
                    text: sanitizedText
                });
                throw new Error('Text is too short for audio generation');
            }
            
            // Limit text length for TTS
            const processedText = sanitizedText.substring(0, 1000);
            
            logWithTimestamp('📝 Processing text', { 
                originalLength: text.length, 
                processedLength: processedText.length,
                preview: processedText.substring(0, 50) + '...'
            });

            // Choose voice configuration
            const selectedVoice = this.VOICE_CONFIGS[voiceIndex] || this.VOICE_CONFIGS[0];
            
            logWithTimestamp('🎵 Selected voice configuration', { 
                voice: selectedVoice.name,
                voiceName: selectedVoice.voiceName 
            });

            // Generate SSML for better speech quality
            const ssml = this.generateSSML(processedText, selectedVoice);
            
            // Call Azure TTS API
            const audioBuffer = await this.callAzureTTS(ssml);
            
            // Convert to base64 for transmission
            const audioBase64 = audioBuffer.toString('base64');
            
            logWithTimestamp('✅ Azure TTS generation completed successfully!');
            return {
                audioData: audioBase64,
                mimeType: 'audio/wav',
                voiceName: selectedVoice.name
            };

        } catch (error) {
            logWithTimestamp('❌ Azure TTS service error', { error: error.message });
            throw new Error(`Azure TTS generation failed: ${error.message}`);
        }
    }

    static generateSSML(text, voiceConfig) {
        // Enhanced SSML with better prosody for health information
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
            
            logWithTimestamp('📤 Sending TTS request to Azure');
            
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
                logWithTimestamp('❌ Azure TTS request failed', { 
                    status: response.status,
                    response: errorText.substring(0, 300)
                });
                throw new Error(`Azure TTS API Error: ${response.status} - ${errorText}`);
            }

            const audioBuffer = await response.buffer();
            
            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Empty audio response from Azure TTS');
            }

            logWithTimestamp('✅ TTS request successful', { 
                audioSize: `${Math.round(audioBuffer.length / 1024)}KB` 
            });
            
            return audioBuffer;

        } catch (error) {
            logWithTimestamp('❌ Failed to call Azure TTS API', { error: error.message });
            throw error;
        }
    }

    static async generateSpeechWithFallback(text) {
        try {
            return await this.generateSpeech(text, 0);
        } catch (error) {
            logWithTimestamp('❌ Primary TTS failed, trying with alternative voice...');
            
            // Try with alternative voice
            try {
                return await this.generateSpeech(text.substring(0, 800), 1);
            } catch (fallbackError) {
                logWithTimestamp('❌ All TTS attempts failed', { error: fallbackError.message });
                throw new Error(`All TTS attempts failed: ${fallbackError.message}`);
            }
        }
    }
}

// Fallback service
class FallbackResponseService {
    static async generateFallbackResponse(text, type = 'general') {
        logWithTimestamp(`⚠️ Using fallback response (text-only) for ${type} mode`);
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

        // Validate input
        if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input. Please provide a non-empty text message.'
            });
        }

        // Sanitize input
        const sanitizedInput = userInput.trim().substring(0, 500);
        logWithTimestamp('📥 Processing general chat request', { 
            inputLength: sanitizedInput.length,
            mode: mode,
            preview: sanitizedInput.substring(0, 100) + (sanitizedInput.length > 100 ? '...' : '')
        });

        // Step 1: Generate AI response
        const aiText = await OpenRouterService.generateResponse(sanitizedInput, GENERAL_SYSTEM_PROMPT);

        // Step 2: Generate audio response
        let audioResponse;
        
        try {
            logWithTimestamp('🎤 Attempting Azure TTS generation for general chat...');
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
            
            logWithTimestamp('✅ Azure TTS generation successful for general chat');
            
        } catch (ttsError) {
            logWithTimestamp('❌ Azure TTS failed for general chat, using fallback', { error: ttsError.message });
            audioResponse = await FallbackResponseService.generateFallbackResponse(aiText, 'general');
        }

        const processingTime = Date.now() - startTime;
        logWithTimestamp(`🎯 General chat request completed`, { processingTime: `${processingTime}ms` });

        // Send response
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
                processingTime
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        logWithTimestamp('❌ General chat request failed', { 
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

// New Symptom Checker endpoint
app.post('/api/symptom-check', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { symptoms } = req.body;

        // Validate input
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input. Please provide an array of symptoms.'
            });
        }

        // Sanitize and validate symptoms
        const validSymptoms = symptoms.filter(symptom => 
            typeof symptom === 'string' && SYMPTOM_DESCRIPTIONS.hasOwnProperty(symptom)
        );

        if (validSymptoms.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid symptoms provided.'
            });
        }

        logWithTimestamp('🔍 Processing symptom check request', { 
            totalSymptoms: symptoms.length,
            validSymptoms: validSymptoms.length,
            symptoms: validSymptoms
        });

        // Step 1: Generate symptom analysis
        const aiText = await OpenRouterService.generateSymptomResponse(validSymptoms);

        // Step 2: Generate audio response with specialized voice for medical content
        let audioResponse;
        
        try {
            logWithTimestamp('🎤 Attempting Azure TTS generation for symptom analysis...');
            // Use more gentle voice (Sara) for symptom analysis
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
            
            logWithTimestamp('✅ Azure TTS generation successful for symptom analysis');
            
        } catch (ttsError) {
            logWithTimestamp('❌ Azure TTS failed for symptom analysis, using fallback', { error: ttsError.message });
            audioResponse = await FallbackResponseService.generateFallbackResponse(aiText, 'symptom');
            audioResponse.analyzedSymptoms = validSymptoms;
        }

        const processingTime = Date.now() - startTime;
        logWithTimestamp(`🎯 Symptom check request completed`, { 
            processingTime: `${processingTime}ms`,
            symptomsAnalyzed: validSymptoms.length
        });

        // Send response
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
                processingTime
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        logWithTimestamp('❌ Symptom check request failed', { 
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
        // Test Azure connection
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
            region: AZURE_SPEECH_REGION,
            version: '3.1.0'
        });
    } catch (error) {
        res.json({
            status: 'partial',
            timestamp: new Date().toISOString(),
            services: {
                openrouter: !!OPENROUTER_API_KEY,
                azure: !!AZURE_SPEECH_KEY && !!AZURE_SPEECH_REGION,
                azureConnection: false
            },
            features: {
                generalChat: true,
                symptomChecker: true,
                audioTTS: false
            },
            error: error.message
        });
    }
});

// Test endpoint for symptom checker
app.post('/api/test-symptom-check', async (req, res) => {
    try {
        const testSymptoms = req.body.symptoms || ['irregular_periods', 'acne', 'weight_gain'];
        
        logWithTimestamp('🧪 Running test symptom check request...');
        
        // Generate symptom analysis
        const aiText = await OpenRouterService.generateSymptomResponse(testSymptoms);
        
        // Try Azure TTS generation
        const ttsResult = await AzureTTSService.generateSpeech(aiText, 2);
        
        res.json({
            success: true,
            message: 'Symptom check test completed successfully',
            data: {
                testSymptoms: testSymptoms,
                symptomDescriptions: testSymptoms.map(s => SYMPTOM_DESCRIPTIONS[s] || s),
                aiResponse: aiText,
                audioData: ttsResult.audioData,
                service: 'azure-tts',
                voiceName: ttsResult.voiceName
            }
        });
        
    } catch (error) {
        logWithTimestamp('❌ Test symptom check failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint for Azure TTS
app.get('/api/test-azure', async (req, res) => {
    try {
        logWithTimestamp('🧪 Testing Azure TTS connection and configuration...');
        
        const connectionTest = await AzureTTSService.testConnection();
        
        if (!connectionTest) {
            throw new Error('Azure TTS connection test failed');
        }
        
        res.json({
            success: true,
            message: 'Azure TTS connection test successful',
            data: {
                region: AZURE_SPEECH_REGION,
                availableVoices: AzureTTSService.VOICE_CONFIGS.map(voice => ({
                    name: voice.name,
                    voiceName: voice.voiceName,
                    style: voice.style,
                    gender: voice.gender
                })),
                connectionStatus: 'active',
                features: {
                    generalMode: 'Aria - Cheerful voice for general conversations',
                    symptomMode: 'Sara - Gentle voice for symptom analysis'
                }
            }
        });
    } catch (error) {
        logWithTimestamp('❌ Azure TTS test failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
            region: AZURE_SPEECH_REGION,
            keyPresent: !!AZURE_SPEECH_KEY
        });
    }
});

// Test chat endpoint (for development)
app.post('/api/test-chat', async (req, res) => {
    try {
        const testText = req.body.text || "Hello! This is a test message for the She Nurtures AI assistant in general mode.";
        
        logWithTimestamp('🧪 Running test chat request...');
        
        // Generate AI response
        const aiText = await OpenRouterService.generateResponse(testText);
        
        // Try Azure TTS generation with shorter text for testing
        const ttsResult = await AzureTTSService.generateSpeech(aiText.substring(0, 200));
        
        res.json({
            success: true,
            message: 'Test completed successfully',
            data: {
                originalText: testText,
                aiResponse: aiText,
                audioData: ttsResult.audioData,
                service: 'azure-tts',
                voiceName: ttsResult.voiceName,
                mode: 'general'
            }
        });
        
    } catch (error) {
        logWithTimestamp('❌ Test chat failed', { error: error.message });
        res.status(500).json({
            success: false,
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
    logWithTimestamp('❌ Unhandled error', { error: err.message, stack: err.stack });
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
                'GET /api/symptoms',
                'GET /api/test-azure',
                'POST /api/test-chat',
                'POST /api/test-symptom-check'
            ]
        });
    }
    next();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    logWithTimestamp(`🚀 She Nurtures AI server running on port ${PORT}`);
    logWithTimestamp('🔧 Environment check:', {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: PORT,
        openRouterKey: OPENROUTER_API_KEY ? '✅ Set' : '❌ Missing',
        azureKey: AZURE_SPEECH_KEY ? '✅ Set' : '❌ Missing',
        azureRegion: AZURE_SPEECH_REGION || '❌ Missing'
    });
    
    // Test Azure connection on startup
    try {
        const azureTest = await AzureTTSService.testConnection();
        if (azureTest) {
            logWithTimestamp('✅ Azure TTS service ready and connected');
            console.log('🎤 Voice Configuration Ready');
        } else {
            logWithTimestamp('⚠️ Azure TTS service connection issue - check credentials');
        }
    } catch (error) {
        logWithTimestamp('⚠️ Azure TTS startup test failed', { error: error.message });
    }
    
    logWithTimestamp('🌸 She Nurtures AI is ready with enhanced prompts!');
});
