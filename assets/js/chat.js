class ChatWidget {
    constructor() {
        this.apiEndpoint = 'https://rag-ai-tutorial.mt18843011356.workers.dev/v1/chat/completions';
        
        this.sessionId = this.generateSessionId();
        this.isOpen = false;
        this.isLoading = false;
        this.messageHistory = [];
        
        // Wait for DOM to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    async init() {
        this.createChatElements();
        this.initEventListeners();
        this.addWelcomeMessage();
    }
    
    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9);
    }
    
    createChatElements() {
        this.chatWidget = document.getElementById('chat-widget');
        this.chatWindow = document.getElementById('chat-window');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.chatToggle = document.getElementById('chat-toggle');
        this.chatClose = document.getElementById('chat-close');
        this.chatSend = document.getElementById('chat-send');
        
        if (!this.chatWidget) {
            console.error('Chat widget elements not found. Make sure chat-widget.html is included.');
            return;
        }
    }
    
    initEventListeners() {
        if (!this.chatWidget) return;
        
        this.chatToggle?.addEventListener('click', () => this.toggleChat());
        this.chatClose?.addEventListener('click', () => this.closeChat());
        this.chatSend?.addEventListener('click', () => this.sendMessage());
        this.chatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.chatWidget.contains(e.target)) {
                setTimeout(() => {
                    if (!this.chatWidget.matches(':hover')) {
                        this.closeChat();
                    }
                }, 100);
            }
        });
        
        this.chatWidget?.addEventListener('click', (e) => e.stopPropagation());
    }
    
    addWelcomeMessage() {
        setTimeout(() => {
            this.addMessage('assistant', "👋 Hi! I'm here to help you learn more about projects posted on my website. What would you like to know?");
        }, 500);
    }
    
    toggleChat() {
        this.isOpen ? this.closeChat() : this.openChat();
    }
    
    openChat() {
        if (!this.chatWindow) return;
        this.chatWindow.classList.remove('hidden');
        this.chatToggle.style.display = 'none';
        this.isOpen = true;
        setTimeout(() => this.chatInput?.focus(), 300);
        this.scrollToBottom();
    }
    
    closeChat() {
        if (!this.chatWindow) return;
        this.chatWindow.classList.add('hidden');
        this.chatToggle.style.display = 'flex';
        this.isOpen = false;
    }
    
    async sendMessage() {
        const message = this.chatInput?.value?.trim();
        if (!message || this.isLoading) return;
        
        this.addMessage('user', message);
        this.chatInput.value = '';
        this.messageHistory.push({ role: 'user', content: message });
        
        this.showLoading();
        
        try {
            const response = await this.callBackend(message);
            this.hideLoading();
            this.messageHistory.push({ role: 'assistant', content: response });
        } catch (error) {
            this.hideLoading();
            console.error('Chat error:', error);
            this.addMessage('assistant', "Sorry, I'm having trouble connecting right now. Please try again later! 😅");
        }
    }
    
    async callBackend(message) {
        const payload = {
            messages: [
                ...this.messageHistory.map(m => ({ role: m.role, content: m.content })),
                { role: "user", content: message }
            ],
            stream: true,
            rag: { enable: true, namespace: "default", topK: 3 }
        };
    
        const response = await fetch(this.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let botReply = "";
        let retrievalShown = false;
    
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
    
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
    
            for (const line of lines) {
                if (!line.trim()) continue;
                if (line.trim() === "data: [DONE]") return botReply;
    
                const dataStr = line.startsWith("data: ") ? line.slice(6) : line;
    
                try {
                    const parsed = JSON.parse(dataStr);
    
                    // Show retrieval links once, before model reply
                    if (parsed.retrieval && !retrievalShown) {
                        retrievalShown = true;
                        this.addRetrievalLinks(parsed.retrieval);
                    }
    
                    // Handle streamed delta text
                    const delta = parsed?.response || parsed?.choices?.[0]?.delta?.content || "";
                    if (delta) {
                        botReply += delta;
                        this.addMessagePartial("assistant", delta);
                    }
                } catch {
                    // Fallback: append raw text if not JSON
                    botReply += dataStr;
                    this.addMessagePartial("assistant", dataStr);
                }
            }
        }
    
        return botReply;
    }
    
    
    addMessagePartial(sender, text) {
        if (!this.chatMessages) return;

        let lastMsg = this.chatMessages.querySelector(`.chat-message.${sender}-message:last-child`);
        if (!lastMsg || !lastMsg.dataset.partial) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${sender}-message`;
            messageDiv.dataset.partial = "true";

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = text;

            messageDiv.appendChild(contentDiv);
            this.chatMessages.appendChild(messageDiv);
        } else {
            const contentDiv = lastMsg.querySelector('.message-content');
            contentDiv.textContent += text;
        }
        this.scrollToBottom();
    }
    
    addMessage(sender, message) {
        if (!this.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addRetrievalLinks(links) {
        if (!this.chatMessages || !Array.isArray(links)) return;
    
        const messageDiv = document.createElement("div");
        messageDiv.className = "chat-message assistant-message retrieval-message";
    
        const contentDiv = document.createElement("div");
        contentDiv.className = "message-content";
        contentDiv.innerHTML = `<b>🔎 Related Sections:</b><br>` +
            links.map(l => {
                const safeHeading = l.heading || "Untitled";
                const safeLink = l.link || "#";
                return `<a href="${safeLink}" target="_blank">${safeHeading}</a>`;
            }).join("<br>");
    
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    showLoading() {
        if (!this.chatMessages) return;
        
        this.isLoading = true;
        this.chatSend.disabled = true;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message assistant-message loading-message';
        loadingDiv.id = 'loading-message';
        loadingDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(loadingDiv);
        this.scrollToBottom();
    }
    
    hideLoading() {
        this.isLoading = false;
        this.chatSend.disabled = false;
        document.getElementById('loading-message')?.remove();
    }
    
    scrollToBottom() {
        if (!this.chatMessages) return;
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
}

// Initialize chat widget
window.ChatWidget = ChatWidget;
if (typeof window.chatWidgetInstance === 'undefined') {
    window.chatWidgetInstance = new ChatWidget();
}
