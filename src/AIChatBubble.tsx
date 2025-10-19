import React from 'react';
import { motion } from "motion/react";
import { 
  MessageCircle,
  Send,
  XCircle,
  Bot
} from "lucide-react";
import { marked } from 'marked';
import { chatService, VectaraQueryResult } from './chatService';

interface SessionSummaryType {
  duration: number;
  accuracy: number;
  notesPlayed: number;
  mistakes: Array<{
    finger: string;
    timestamp: number;
    note: string;
  }>;
  conversationSummary?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: VectaraQueryResult[];
}

interface AIChatBubbleProps {
  summary: SessionSummaryType;
}

export function AIChatBubble({ summary }: AIChatBubbleProps) {
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (mins > 0) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
    if (secs > 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
    
    return parts.length > 0 ? parts.join(' and ') : '0 seconds';
  };

  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi! I'm Professor Melody, your AI music coach assistant. I've analyzed your ${formatDuration(summary.duration)} practice session and I'm here to help you understand your performance and answer any questions you might have! 🎹`,
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoading(true);

    try {
      const response = await chatService.askQuestion(chatInput.trim());
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        context: response.sources
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isChatOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.3 }}
          className="mb-4 w-80 h-96 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 overflow-hidden"
        >
          {/* Chat Header */}
          <div className="p-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-sm font-semibold">Melody</h3>
                  <p className="text-slate-300 text-xs">AI Music Coach</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-xs ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                      : 'bg-white/10 text-white border border-white/20'
                  }`}
                >
                  <div 
                    className="prose prose-sm max-w-none [&_strong]:text-white [&_em]:text-slate-200 [&_ul]:text-slate-200 [&_li]:text-slate-200 [&_p]:text-white [&_*]:text-white"
                    dangerouslySetInnerHTML={{ 
                      __html: marked(message.content, { breaks: true })
                    }}
                  />
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-slate-200' : 'text-slate-300'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  
                  {/* Show context for assistant messages */}
                  {message.role === 'assistant' && message.context && message.context.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/20">
                      <p className="text-xs font-medium text-slate-200 mb-1">Based on:</p>
                      <div className="space-y-1">
                        {message.context.slice(0, 2).map((ctx, idx) => (
                          <div key={idx} className="text-xs text-slate-300">
                            <span className="font-medium">{ctx.metadata.timestamp}:</span>{' '}
                            User {ctx.metadata.userAction} → {ctx.metadata.tutorResponse}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-300"></div>
                    <span className="text-xs">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Melody..."
                className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-transparent text-xs"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isLoading}
                className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg transition-all disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isChatOpen ? (
          <XCircle className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </motion.button>
    </div>
  );
}
