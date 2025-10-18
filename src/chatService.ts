/**
 * Chat Service for Vectara RAG Integration
 * Implements retrieval-augmented generation pattern
 */

interface VectaraQueryResult {
  documentId: string;
  score: number;
  text: string;
  metadata: {
    sessionId: string;
    day: string;
    timestamp: string;
    userAction: string;
    tutorResponse: string;
  };
}

interface ChatResponse {
  answer: string;
  sources: VectaraQueryResult[];
}

class ChatService {
  private vectaraConfig = {
    customerId: import.meta.env.VITE_VECTARA_CUSTOMER_ID,
    corpusId: import.meta.env.VITE_VECTARA_CORPUS_ID,
    apiKey: import.meta.env.VITE_VECTARA_API_KEY,
  };

  private geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  /**
   * Query Vectara for relevant session chunks
   */
  async queryVectara(question: string, numResults: number = 5): Promise<VectaraQueryResult[]> {
    try {
      // Check if API keys are configured
      if (!this.vectaraConfig.apiKey || !this.vectaraConfig.customerId || !this.vectaraConfig.corpusId) {
        console.warn('Vectara API keys not configured, using mock data');
        return this.getMockVectaraResults(question, numResults);
      }

      const response = await fetch('https://api.vectara.io/v1/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'customer-id': this.vectaraConfig.customerId,
          'x-api-key': this.vectaraConfig.apiKey,
        },
        body: JSON.stringify({
          query: [
            {
              query: question,
              numResults,
              corpusKey: [
                {
                  customerId: parseInt(this.vectaraConfig.customerId),
                  corpusId: parseInt(this.vectaraConfig.corpusId),
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Vectara query failed: ${response.status}`);
      }

      const data = await response.json();
      const results = data.responseSet?.[0]?.response || [];

      return results.map((result: any) => ({
        documentId: result.documentIndex,
        score: result.score,
        text: result.text,
        metadata: result.metadata || {},
      }));
    } catch (error) {
      console.error('Error querying Vectara:', error);
      return this.getMockVectaraResults(question, numResults);
    }
  }

  /**
   * Generate answer using Gemini with retrieved context
   */
  async generateAnswer(question: string, context: VectaraQueryResult[]): Promise<string> {
    try {
      // Check if Gemini API key is configured
      if (!this.geminiApiKey) {
        console.warn('Gemini API key not configured, using mock response');
        return this.getMockGeminiResponse(question, context);
      }

      // Build context text from Vectara results
      const contextText = context.length > 0 
        ? `\n\nRelevant session history:\n${context.map(c => 
            `- ${c.text}`
          ).join('\n')}`
        : '';

      const prompt = `You are Melody, an AI piano coach assistant. You help users review their past learning sessions and provide insights about their progress.

${contextText}

User question: ${question}

Please provide a helpful response based on the session history and context provided. If no relevant context is available, ask the user to clarify what they'd like to know about their piano learning sessions. Keep responses conversational and encouraging.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API failed: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    } catch (error) {
      console.error('Error generating answer with Gemini:', error);
      return this.getMockGeminiResponse(question, context);
    }
  }

  /**
   * Main RAG function that combines Vectara retrieval with Gemini generation
   */
  async askQuestion(question: string): Promise<ChatResponse> {
    try {
      // Step 1: Retrieve relevant context from Vectara
      const context = await this.queryVectara(question, 5);
      
      // Step 2: Generate answer using Gemini with retrieved context
      const answer = await this.generateAnswer(question, context);
      
      return {
        answer,
        sources: context,
      };
    } catch (error) {
      console.error('Error in RAG pipeline:', error);
      return {
        answer: 'Sorry, I encountered an error while processing your question. Please try again.',
        sources: [],
      };
    }
  }

  /**
   * Mock Vectara results for development/testing
   */
  private getMockVectaraResults(question: string, numResults: number): VectaraQueryResult[] {
    const mockResults: VectaraQueryResult[] = [
      {
        documentId: 'mock_1',
        score: 0.95,
        text: 'User Action: Placed thumb on C\nTutor Response: Good! Now place thumb on D',
        metadata: {
          sessionId: 'session_2025-01-18_001',
          day: '2025-01-18',
          timestamp: '10:30:15',
          userAction: 'Placed thumb on C',
          tutorResponse: 'Good! Now place thumb on D',
        },
      },
      {
        documentId: 'mock_2',
        score: 0.87,
        text: 'User Action: Played C major scale\nTutor Response: Excellent! Your timing is improving',
        metadata: {
          sessionId: 'session_2025-01-17_002',
          day: '2025-01-17',
          timestamp: '14:20:30',
          userAction: 'Played C major scale',
          tutorResponse: 'Excellent! Your timing is improving',
        },
      },
      {
        documentId: 'mock_3',
        score: 0.82,
        text: 'User Action: Practiced chord transitions\nTutor Response: Focus on keeping your fingers curved',
        metadata: {
          sessionId: 'session_2025-01-16_003',
          day: '2025-01-16',
          timestamp: '16:45:12',
          userAction: 'Practiced chord transitions',
          tutorResponse: 'Focus on keeping your fingers curved',
        },
      },
    ];

    return mockResults.slice(0, numResults);
  }

  /**
   * Mock Gemini response for development/testing
   */
  private getMockGeminiResponse(question: string, context: VectaraQueryResult[]): string {
    const responses = [
      "Based on your session history, I can see you've been working on piano fundamentals. Keep practicing!",
      "Your recent sessions show good progress. I notice you're focusing on hand positioning and timing.",
      "From what I can see in your session logs, you're making steady improvements. Great work!",
      "I can see from your past sessions that you've been working on scales and chord progressions. Keep it up!",
      "Your session history indicates you're developing good piano technique. Continue with regular practice."
    ];
    
    if (context.length > 0) {
      return `Based on your session history, I can see you've been working on various piano techniques. ${responses[Math.floor(Math.random() * responses.length)]}`;
    }
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

export const chatService = new ChatService();
export type { VectaraQueryResult, ChatResponse };
