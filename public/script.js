// Enhanced script.js - Dual-Mode Interface with Chat Bubbles and Symptom Checker

// Application State Management
class AppState {
    constructor() {
        this.isLoading = false;
        this.currentAudio = null;
        this.conversationHistory = [];
        this.audioQueue = [];
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isPlaying = false;
        this.currentMode = 'general'; // 'general' or 'symptom'
        this.selectedSymptoms = new Set();
    }

    setLoading(loading) {
        this.isLoading = loading;
    }

    setPlaying(playing) {
        this.isPlaying = playing;
    }

    setMode(mode) {
        this.currentMode = mode;
    }

    addToHistory(question, response, type = 'general') {
        this.conversationHistory.push({
            timestamp: new Date().toISOString(),
            question,
            response,
            type,
            mode: this.currentMode
        });
        // Keep only last 20 conversations in memory
        if (this.conversationHistory.length > 20) {
            this.conversationHistory.shift();
        }
    }

    addSymptom(symptom) {
        this.selectedSymptoms.add(symptom);
    }

    removeSymptom(symptom) {
        this.selectedSymptoms.delete(symptom);
    }

    clearSymptoms() {
        this.selectedSymptoms.clear();
    }

    getSelectedSymptoms() {
        return Array.from(this.selectedSymptoms);
    }

    incrementRetry() {
        this.retryCount++;
    }

    resetRetry() {
        this.retryCount = 0;
    }

    canRetry() {
        return this.retryCount < this.maxRetries;
    }

    setCurrentAudio(audio) {
        // Stop previous audio if playing
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
        }
        this.currentAudio = audio;
    }
}

// UI Controller Class
class UIController {
    constructor() {
        this.elements = this.initializeElements();
        this.setupEventListeners();
        this.setupSuggestionChips();
        this.setupModeSelection();
        this.setupSymptomChecker();
        this.initializeUI();
    }

    initializeElements() {
        return {
            // Avatar elements
            avatarPlaceholder: document.getElementById('avatar-placeholder'),
            avatarImage: document.querySelector('.avatar-image'),
            avatarWrapper: document.querySelector('.avatar-wrapper'),
            
            // Mode selection
            generalModeBtn: document.getElementById('general-mode-btn'),
            symptomModeBtn: document.getElementById('symptom-mode-btn'),
            generalModeContent: document.getElementById('general-mode-content'),
            symptomModeContent: document.getElementById('symptom-mode-content'),
            
            // General mode elements
            chatMessages: document.getElementById('chat-messages'),
            generalInput: document.getElementById('general-input'),
            generalAskButton: document.getElementById('general-ask-button'),
            generalClearButton: document.getElementById('general-clear-button'),
            generalCharCount: document.getElementById('general-char-count'),
            
            // Symptom checker elements
            symptomForm: document.getElementById('symptom-form'),
            analyzeSymptoms: document.getElementById('analyze-symptoms'),
            clearSymptoms: document.getElementById('clear-symptoms'),
            symptomResults: document.getElementById('symptom-results'),
            symptomAnalysis: document.getElementById('symptom-analysis'),
            connectDoctor: document.getElementById('connect-doctor'),
            
            // Audio controls
            audioControls: document.getElementById('audio-controls'),
            playPauseBtn: document.getElementById('play-pause-btn'),
            stopBtn: document.getElementById('stop-btn'),
            audioStatus: document.getElementById('audio-status'),
            playIcon: document.getElementById('play-icon'),
            pauseIcon: document.getElementById('pause-icon'),
            
            // Modal elements
            infoButton: document.getElementById('info-button'),
            infoModal: document.getElementById('info-modal'),
            closeModal: document.getElementById('close-modal'),
            
            // Status elements
            statusText: document.querySelector('.status-text'),
            statusDot: document.querySelector('.status-dot'),
            
            // Toast elements
            errorToast: document.getElementById('error-toast'),
            errorMessage: document.getElementById('error-message'),
            successToast: document.getElementById('success-toast'),
            successMessage: document.getElementById('success-message'),
            
            // Loading screen
            loadingScreen: document.getElementById('loading-screen'),
            
            // Suggestion chips
            suggestionChips: document.querySelectorAll('.suggestion-chip')
        };
    }

    initializeUI() {
        // Hide loading screen after initialization
        setTimeout(() => {
            if (this.elements.loadingScreen) {
                this.elements.loadingScreen.style.display = 'none';
            }
        }, 1000);

        // Set initial avatar state
        this.showAvatarPlaceholder();
        
        // Initialize character counter
        this.updateCharCount();
        
        // Set initial mode
        this.switchMode('general');
        
        // Focus on input
        if (this.elements.generalInput) {
            this.elements.generalInput.focus();
        }
    }

    setupEventListeners() {
        // General mode input events
        if (this.elements.generalInput) {
            this.elements.generalInput.addEventListener('input', () => this.handleGeneralInputChange());
            this.elements.generalInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        }
        
        // Button events
        if (this.elements.generalAskButton) {
            this.elements.generalAskButton.addEventListener('click', () => this.handleGeneralAskClick());
        }
        
        if (this.elements.generalClearButton) {
            this.elements.generalClearButton.addEventListener('click', () => this.clearGeneralInput());
        }
        
        // Audio control events
        if (this.elements.playPauseBtn) {
            this.elements.playPauseBtn.addEventListener('click', () => this.toggleAudio());
        }
        
        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.stopAudio());
        }
        
        // Modal events
        if (this.elements.infoButton) {
            this.elements.infoButton.addEventListener('click', () => this.showModal());
        }
        
        if (this.elements.closeModal) {
            this.elements.closeModal.addEventListener('click', () => this.hideModal());
        }
        
        // Click outside modal to close
        if (this.elements.infoModal) {
            this.elements.infoModal.addEventListener('click', (e) => {
                if (e.target === this.elements.infoModal) {
                    this.hideModal();
                }
            });
        }
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.infoModal && this.elements.infoModal.style.display !== 'none') {
                    this.hideModal();
                }
            }
        });
    }

    setupModeSelection() {
        if (this.elements.generalModeBtn) {
            this.elements.generalModeBtn.addEventListener('click', () => this.switchMode('general'));
        }
        
        if (this.elements.symptomModeBtn) {
            this.elements.symptomModeBtn.addEventListener('click', () => this.switchMode('symptom'));
        }
    }

    setupSymptomChecker() {
        // Symptom form submission
        if (this.elements.symptomForm) {
            this.elements.symptomForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSymptomSubmission();
            });
        }
        
        // Clear symptoms button
        if (this.elements.clearSymptoms) {
            this.elements.clearSymptoms.addEventListener('click', () => this.clearSelectedSymptoms());
        }
        
        // Connect doctor button
        if (this.elements.connectDoctor) {
            this.elements.connectDoctor.addEventListener('click', () => this.handleConnectDoctor());
        }
        
        // Symptom checkboxes
        const symptomCheckboxes = document.querySelectorAll('input[name="symptom"]');
        symptomCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleSymptomChange(e));
        });
    }

    setupSuggestionChips() {
        this.elements.suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const question = chip.dataset.question;
                if (question && this.elements.generalInput) {
                    this.elements.generalInput.value = question;
                    this.updateCharCount();
                    this.elements.generalInput.focus();
                }
            });
        });
    }

    switchMode(mode) {
        appState.setMode(mode);
        
        // Update mode buttons
        document.querySelectorAll('.mode-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (mode === 'general') {
            this.elements.generalModeBtn?.classList.add('active');
            this.elements.generalModeContent.classList.add('active');
            this.elements.symptomModeContent.classList.remove('active');
        } else if (mode === 'symptom') {
            this.elements.symptomModeBtn?.classList.add('active');
            this.elements.symptomModeContent.classList.add('active');
            this.elements.generalModeContent.classList.remove('active');
        }
        
        // Stop any current audio
        this.stopCurrentAudio();
        
        // Hide audio controls when switching modes
        this.hideAudioControls();
    }

    handleGeneralInputChange() {
        this.updateCharCount();
        const hasText = this.elements.generalInput ? this.elements.generalInput.value.trim().length > 0 : false;
        if (this.elements.generalClearButton) {
            this.elements.generalClearButton.style.display = hasText ? 'flex' : 'none';
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleGeneralAskClick();
        }
    }

    handleGeneralAskClick() {
        const userText = this.elements.generalInput ? this.elements.generalInput.value.trim() : '';
        if (userText && !appState.isLoading) {
            app.processGeneralInput(userText);
        }
    }

    handleSymptomChange(e) {
        const symptom = e.target.value;
        if (e.target.checked) {
            appState.addSymptom(symptom);
        } else {
            appState.removeSymptom(symptom);
        }
        
        // Update analyze button state
        const hasSymptoms = appState.getSelectedSymptoms().length > 0;
        if (this.elements.analyzeSymptoms) {
            this.elements.analyzeSymptoms.disabled = !hasSymptoms;
        }
    }

    handleSymptomSubmission() {
        const selectedSymptoms = appState.getSelectedSymptoms();
        if (selectedSymptoms.length > 0 && !appState.isLoading) {
            app.processSymptomCheck(selectedSymptoms);
        }
    }

    clearSelectedSymptoms() {
        appState.clearSymptoms();
        
        // Uncheck all symptom checkboxes
        document.querySelectorAll('input[name="symptom"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Disable analyze button
        if (this.elements.analyzeSymptoms) {
            this.elements.analyzeSymptoms.disabled = true;
        }
        
        // Hide results
        if (this.elements.symptomResults) {
            this.elements.symptomResults.style.display = 'none';
        }
    }

    handleConnectDoctor() {
        // In a real implementation, this would integrate with a telemedicine service
        this.showToast('Redirecting to healthcare provider directory...', 'success');
        
        // For now, show information about finding healthcare
        setTimeout(() => {
            alert('For personalized medical advice, please:\n\n1. Contact your primary care physician\n2. Visit a gynecologist or endocrinologist\n3. Use telemedicine services like Teladoc or MDLive\n4. Search for local healthcare providers\n\nAlways consult qualified healthcare professionals for medical concerns.');
        }, 1000);
    }

    updateCharCount() {
        if (this.elements.generalInput && this.elements.generalCharCount) {
            const length = this.elements.generalInput.value.length;
            this.elements.generalCharCount.textContent = `${length}/500`;
            this.elements.generalCharCount.classList.toggle('warning', length > 450);
        }
    }

    clearGeneralInput() {
        if (this.elements.generalInput) {
            this.elements.generalInput.value = '';
            this.updateCharCount();
            this.elements.generalInput.focus();
        }
        if (this.elements.generalClearButton) {
            this.elements.generalClearButton.style.display = 'none';
        }
    }

    setLoadingState(loading, mode = 'general') {
        if (mode === 'general') {
            if (this.elements.generalAskButton) {
                this.elements.generalAskButton.disabled = loading;
                
                if (loading) {
                    this.elements.generalAskButton.classList.add('loading');
                    const buttonText = this.elements.generalAskButton.querySelector('.button-text');
                    if (buttonText) buttonText.textContent = 'Processing...';
                } else {
                    this.elements.generalAskButton.classList.remove('loading');
                    const buttonText = this.elements.generalAskButton.querySelector('.button-text');
                    if (buttonText) buttonText.textContent = 'Ask Question';
                }
            }
            
            if (this.elements.generalInput) {
                this.elements.generalInput.disabled = loading;
            }
        } else if (mode === 'symptom') {
            if (this.elements.analyzeSymptoms) {
                this.elements.analyzeSymptoms.disabled = loading;
                
                if (loading) {
                    this.elements.analyzeSymptoms.classList.add('loading');
                    const buttonText = this.elements.analyzeSymptoms.querySelector('.button-text');
                    if (buttonText) buttonText.textContent = 'Analyzing...';
                } else {
                    this.elements.analyzeSymptoms.classList.remove('loading');
                    const buttonText = this.elements.analyzeSymptoms.querySelector('.button-text');
                    if (buttonText) buttonText.textContent = 'Get Information';
                }
            }
        }
        
        this.updateStatus(loading ? 'Processing your request...' : 'Ready to help', loading ? 'processing' : 'ready');
    }

    updateStatus(text, status = 'ready') {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = text;
        }
        
        if (this.elements.statusDot) {
            this.elements.statusDot.className = 'status-dot';
            if (status === 'processing') {
                this.elements.statusDot.classList.add('status-processing');
            } else if (status === 'error') {
                this.elements.statusDot.classList.add('status-error');
            } else if (status === 'speaking') {
                this.elements.statusDot.classList.add('status-speaking');
            }
        }
    }

    showAvatarPlaceholder() {
        if (this.elements.avatarPlaceholder) {
            this.elements.avatarPlaceholder.style.display = 'block';
        }
        this.stopAvatarAnimation();
    }

    startAvatarAnimation() {
        if (this.elements.avatarWrapper) {
            this.elements.avatarWrapper.classList.add('speaking');
        }
    }

    stopAvatarAnimation() {
        if (this.elements.avatarWrapper) {
            this.elements.avatarWrapper.classList.remove('speaking');
        }
    }

    addMessageToChat(message, isUser = false, animate = true) {
        if (!this.elements.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(contentDiv);
        this.elements.chatMessages.appendChild(messageDiv);
        
        // Auto-scroll to bottom
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        
        return messageDiv;
    }

    displaySymptomAnalysis(analysis) {
        if (this.elements.symptomAnalysis && this.elements.symptomResults) {
            this.elements.symptomAnalysis.textContent = analysis;
            this.elements.symptomResults.style.display = 'block';
            
            // Scroll to results
            this.elements.symptomResults.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        }
    }

    showAudioControls() {
        if (this.elements.audioControls) {
            this.elements.audioControls.classList.remove('hidden');
        }
    }

    hideAudioControls() {
        if (this.elements.audioControls) {
            this.elements.audioControls.classList.add('hidden');
        }
    }

    updateAudioControls(playing) {
        if (this.elements.playIcon && this.elements.pauseIcon) {
            this.elements.playIcon.style.display = playing ? 'none' : 'block';
            this.elements.pauseIcon.style.display = playing ? 'block' : 'none';
        }
    }

    toggleAudio() {
        if (appState.currentAudio) {
            if (appState.currentAudio.paused) {
                appState.currentAudio.play();
            } else {
                appState.currentAudio.pause();
            }
        }
    }

    stopAudio() {
        if (appState.currentAudio) {
            appState.currentAudio.pause();
            appState.currentAudio.currentTime = 0;
        }
    }

    playAudio(audioData, mimeType = 'audio/wav') {
        return new Promise((resolve, reject) => {
            try {
                // Convert base64 to blob
                const binaryString = atob(audioData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: mimeType });
                const audioUrl = URL.createObjectURL(blob);
                
                // Create and configure audio element
                const audio = new Audio(audioUrl);
                audio.preload = 'auto';
                
                // Set up event listeners
                audio.addEventListener('loadstart', () => {
                    this.updateStatus('Loading audio...', 'processing');
                });
                
                audio.addEventListener('canplay', () => {
                    this.updateStatus('Audio ready', 'ready');
                    this.showAudioControls();
                });
                
                audio.addEventListener('play', () => {
                    appState.setPlaying(true);
                    this.startAvatarAnimation();
                    this.updateStatus('Speaking...', 'speaking');
                    this.updateAudioControls(true);
                });
                
                audio.addEventListener('pause', () => {
                    appState.setPlaying(false);
                    this.stopAvatarAnimation();
                    this.updateStatus('Audio paused', 'ready');
                    this.updateAudioControls(false);
                });
                
                audio.addEventListener('ended', () => {
                    appState.setPlaying(false);
                    this.stopAvatarAnimation();
                    this.updateStatus('Response complete', 'ready');
                    this.updateAudioControls(false);
                    URL.revokeObjectURL(audioUrl);
                    setTimeout(() => {
                        this.updateStatus('Ready to help', 'ready');
                        this.hideAudioControls();
                    }, 3000);
                    resolve();
                });
                
                audio.addEventListener('error', (e) => {
                    appState.setPlaying(false);
                    this.stopAvatarAnimation();
                    this.updateStatus('Audio playback failed', 'error');
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('Audio playback failed'));
                });
                
                // Store reference and play
                appState.setCurrentAudio(audio);
                
                // Play the audio
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('Audio playing successfully');
                        })
                        .catch((error) => {
                            console.error('Audio play failed:', error);
                            this.updateStatus('Audio play failed', 'error');
                            reject(error);
                        });
                }
                
            } catch (error) {
                console.error('Audio setup failed:', error);
                this.updateStatus('Audio setup failed', 'error');
                reject(error);
            }
        });
    }

    showModal() {
        if (this.elements.infoModal) {
            this.elements.infoModal.style.display = 'flex';
            this.elements.infoModal.classList.add('modal-show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal() {
        if (this.elements.infoModal) {
            this.elements.infoModal.style.display = 'none';
            this.elements.infoModal.classList.remove('modal-show');
            document.body.style.overflow = 'auto';
        }
    }

    showToast(message, type = 'error') {
        const toast = type === 'error' ? this.elements.errorToast : this.elements.successToast;
        const messageElement = type === 'error' ? this.elements.errorMessage : this.elements.successMessage;
        
        if (toast && messageElement) {
            messageElement.textContent = message;
            toast.style.display = 'flex';
            toast.classList.add('toast-show');
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                this.hideToast(type);
            }, 5000);
        }
    }

    hideToast(type = 'error') {
        const toast = type === 'error' ? this.elements.errorToast : this.elements.successToast;
        
        if (toast) {
            toast.style.display = 'none';
            toast.classList.remove('toast-show');
        }
    }

    hideSuggestionChips() {
        const suggestionsContainer = document.querySelector('.suggested-questions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }

    showSuggestionChips() {
        const suggestionsContainer = document.querySelector('.suggested-questions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'block';
        }
    }

    stopCurrentAudio() {
        if (appState.currentAudio && !appState.currentAudio.paused) {
            appState.currentAudio.pause();
            appState.currentAudio.currentTime = 0;
            appState.setPlaying(false);
            this.stopAvatarAnimation();
            this.updateStatus('Audio stopped', 'ready');
            this.hideAudioControls();
        }
    }
}

// API Service Class
class APIService {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.timeout = 120000; // 2 minutes timeout
    }

    async makeRequest(endpoint, data, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data),
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            
            throw error;
        }
    }

    async sendGeneralMessage(text) {
        return this.makeRequest('/api/chat', { text, mode: 'general' });
    }

    async sendSymptomCheck(symptoms) {
        return this.makeRequest('/api/symptom-check', { symptoms });
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL}/api/health`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    }
}

// Main Application Class
class SheNurturesApp {
    constructor() {
        this.ui = new UIController();
        this.api = new APIService();
        this.initialize();
    }

    async initialize() {
        console.log('🌸 She Nurtures AI - Dual Mode initialized');
        
        // Check server health
        const health = await this.api.checkHealth();
        console.log('Health check:', health);
        
        if (health.status !== 'healthy') {
            this.ui.showToast('Server connection issue detected. Some features may not work properly.', 'error');
        }
    }

    async processGeneralInput(userText) {
        if (appState.isLoading) {
            console.log('Already processing request');
            return;
        }

        try {
            // Validate input
            if (!userText || userText.trim().length === 0) {
                this.ui.showToast('Please enter a question before submitting.', 'error');
                return;
            }

            if (userText.length > 500) {
                this.ui.showToast('Question too long. Please limit to 500 characters.', 'error');
                return;
            }

            // Stop any currently playing audio
            this.ui.stopCurrentAudio();

            // Set loading state
            appState.setLoading(true);
            this.ui.setLoadingState(true, 'general');
            this.ui.hideSuggestionChips();

            // Add user message to chat
            this.ui.addMessageToChat(userText, true);

            console.log('Processing general input:', userText);

            // Send request to backend
            const response = await this.api.sendGeneralMessage(userText);

            if (!response.success) {
                throw new Error(response.error || 'Failed to get response from server');
            }

            const { audioData, text, isFallback, voiceName } = response.data;

            // Add AI response to chat
            this.ui.addMessageToChat(text, false);

            // Handle audio response
            if (audioData && !isFallback) {
                console.log('Playing Azure TTS audio:', voiceName);
                try {
                    await this.ui.playAudio(audioData, 'audio/wav');
                    this.ui.showToast(`Response by ${voiceName}`, 'success');
                } catch (audioError) {
                    console.error('Audio playback error:', audioError);
                    this.ui.showToast('Audio playback failed. Text response available.', 'error');
                }
            } else if (isFallback) {
                console.log('Using fallback response');
                this.ui.showToast('Audio generation unavailable - text response provided', 'error');
                this.ui.updateStatus('Response ready (text only)', 'ready');
            } else {
                console.log('No audio data provided');
                this.ui.updateStatus('Response ready (text only)', 'ready');
            }

            // Add to conversation history
            appState.addToHistory(userText, text, 'general');
            appState.resetRetry();

            // Clear input
            this.ui.clearGeneralInput();

            console.log('General request completed successfully');

        } catch (error) {
            console.error('Error processing general input:', error);

            let errorMessage = 'Sorry, I encountered an error processing your request.';
            
            if (error.message.includes('timeout') || error.message.includes('timed out')) {
                errorMessage = 'Request timed out. Please try again with a shorter question.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message.includes('rate limit')) {
                errorMessage = 'Too many requests. Please wait a moment before trying again.';
            }

            this.ui.showToast(errorMessage, 'error');
            this.ui.updateStatus('Error occurred', 'error');

            // Offer retry option for certain errors
            if (appState.canRetry() && !error.message.includes('rate limit')) {
                setTimeout(() => {
                    if (confirm('Would you like to retry your question?')) {
                        appState.incrementRetry();
                        this.processGeneralInput(userText);
                        return;
                    }
                    appState.resetRetry();
                }, 2000);
            }

        } finally {
            // Reset loading state
            appState.setLoading(false);
            this.ui.setLoadingState(false, 'general');
        }
    }

    async processSymptomCheck(symptoms) {
        if (appState.isLoading) {
            console.log('Already processing symptom check');
            return;
        }

        try {
            // Validate symptoms
            if (!symptoms || symptoms.length === 0) {
                this.ui.showToast('Please select at least one symptom.', 'error');
                return;
            }

            // Stop any currently playing audio
            this.ui.stopCurrentAudio();

            // Set loading state
            appState.setLoading(true);
            this.ui.setLoadingState(true, 'symptom');

            console.log('Processing symptom check:', symptoms);

            // Send request to backend
            const response = await this.api.sendSymptomCheck(symptoms);

            if (!response.success) {
                throw new Error(response.error || 'Failed to get symptom analysis from server');
            }

            const { audioData, text, isFallback, voiceName } = response.data;

            // Display symptom analysis
            this.ui.displaySymptomAnalysis(text);

            // Handle audio response
            if (audioData && !isFallback) {
                console.log('Playing symptom analysis audio:', voiceName);
                try {
                    await this.ui.playAudio(audioData, 'audio/wav');
                    this.ui.showToast(`Analysis by ${voiceName}`, 'success');
                } catch (audioError) {
                    console.error('Audio playback error:', audioError);
                    this.ui.showToast('Audio playback failed. Text analysis available.', 'error');
                }
            } else if (isFallback) {
                console.log('Using fallback response for symptom analysis');
                this.ui.showToast('Audio generation unavailable - text analysis provided', 'error');
                this.ui.updateStatus('Analysis ready (text only)', 'ready');
            } else {
                console.log('No audio data provided for symptom analysis');
                this.ui.updateStatus('Analysis ready (text only)', 'ready');
            }

            // Add to conversation history
            appState.addToHistory(symptoms.join(', '), text, 'symptom');
            appState.resetRetry();

            console.log('Symptom check completed successfully');

        } catch (error) {
            console.error('Error processing symptom check:', error);

            let errorMessage = 'Sorry, I encountered an error analyzing your symptoms.';
            
            if (error.message.includes('timeout') || error.message.includes('timed out')) {
                errorMessage = 'Request timed out. Please try again.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message.includes('rate limit')) {
                errorMessage = 'Too many requests. Please wait a moment before trying again.';
            }

            this.ui.showToast(errorMessage, 'error');
            this.ui.updateStatus('Error occurred', 'error');

            // Offer retry option for certain errors
            if (appState.canRetry() && !error.message.includes('rate limit')) {
                setTimeout(() => {
                    if (confirm('Would you like to retry the symptom analysis?')) {
                        appState.incrementRetry();
                        this.processSymptomCheck(symptoms);
                        return;
                    }
                    appState.resetRetry();
                }, 2000);
            }

        } finally {
            // Reset loading state
            appState.setLoading(false);
            this.ui.setLoadingState(false, 'symptom');
        }
    }

    // Utility method to handle page visibility changes
    handleVisibilityChange() {
        if (document.hidden) {
            // Pause any ongoing audio when page is hidden
            if (appState.currentAudio && !appState.currentAudio.paused) {
                appState.currentAudio.pause();
            }
        } else {
            // Resume audio when page becomes visible (optional)
            if (appState.currentAudio && appState.currentAudio.paused && appState.isPlaying) {
                appState.currentAudio.play().catch(() => {
                    // Ignore play errors when resuming
                });
            }
        }
    }

    // Get conversation summary for debugging
    getConversationSummary() {
        return {
            totalConversations: appState.conversationHistory.length,
            currentMode: appState.currentMode,
            selectedSymptoms: appState.getSelectedSymptoms(),
            isLoading: appState.isLoading,
            isPlaying: appState.isPlaying,
            conversations: appState.conversationHistory.slice(-5) // Last 5 conversations
        };
    }
}

// Initialize global state and application
const appState = new AppState();
let app;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new SheNurturesApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (app) {
        app.handleVisibilityChange();
    }
});

// Handle network status changes
window.addEventListener('online', () => {
    console.log('Network connection restored');
    if (app && app.ui) {
        app.ui.showToast('Connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    console.log('Network connection lost');
    if (app && app.ui) {
        app.ui.showToast('Connection lost. Please check your internet connection.', 'error');
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (app && app.ui && !appState.isLoading) {
        app.ui.showToast('An unexpected error occurred. Please refresh the page.', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevent console spam
});

// Export for debugging (development only)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.SheNurturesDebug = {
        appState,
        app: () => app,
        ui: () => app?.ui,
        api: () => app?.api,
        getConversationSummary: () => app?.getConversationSummary()
    };
}