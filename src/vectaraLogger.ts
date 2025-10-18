/**
 * Vectara Integration for Real-time Conversation Logging
 * Automatically uploads conversation logs to Vectara corpus
 */

interface VectaraConfig {
  customerId: number;
  corpusId: number;
  apiKey: string;
}

interface ConversationEntry {
  timestamp: Date;
  userAction?: string;
  tutorResponse?: string;
  systemEvent?: string;
}

class VectaraLogger {
  private config: VectaraConfig;
  private sessionId: string;
  private day: string;
  private componentName: string;
  private conversationEntries: ConversationEntry[] = [];
  private pendingUserAction: string | null = null;

  constructor(componentName: string) {
    this.componentName = componentName;
    this.sessionId = this.generateSessionId();
    this.day = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get configuration from environment variables
    const apiKey = import.meta.env.VITE_VECTARA_API_KEY;
    const customerId = import.meta.env.VITE_VECTARA_CUSTOMER_ID;
    const corpusId = import.meta.env.VITE_VECTARA_CORPUS_ID;

    if (!apiKey) {
      console.error('❌ [Vectara] VITE_VECTARA_API_KEY not found in environment variables');
    }
    if (!customerId) {
      console.error('❌ [Vectara] VITE_VECTARA_CUSTOMER_ID not found in environment variables');
    }
    if (!corpusId) {
      console.error('❌ [Vectara] VITE_VECTARA_CORPUS_ID not found in environment variables');
    }

    this.config = {
      customerId: Number(customerId),
      corpusId: Number(corpusId),
      apiKey: apiKey
    };

    console.log(`📊 Vectara Logger initialized - Session: ${this.sessionId}`);
  }

  /**
   * Generate session ID in format: AIPianoTutor_session_YYYY-MM-DD_component_HHmmss
   */
  private generateSessionId(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const component = this.componentName.replace(/\s+/g, '_').toLowerCase();
    return `AIPianoTutor_session_${date}_${component}_${time}`;
  }

  /**
   * Log a user action (will be paired with next AI response)
   */
  logUserAction(action: string): void {
    this.pendingUserAction = action;
    console.log(`👤 [Vectara] User action queued: "${action.substring(0, 100)}${action.length > 100 ? '...' : ''}"`);
  }

  /**
   * Log an AI response (pairs with previous user action if exists)
   */
  logAIResponse(response: string): void {
    const entry: ConversationEntry = {
      timestamp: new Date(),
      userAction: this.pendingUserAction || undefined,
      tutorResponse: response
    };

    this.conversationEntries.push(entry);

    console.log(`🤖 [Vectara] AI response received: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
    console.log(`🔗 [Vectara] Pairing with user action: "${this.pendingUserAction?.substring(0, 100) || 'NONE'}"`);
    console.log(`📝 [Vectara] Total entries in session: ${this.conversationEntries.length}`);

    // Upload after each AI response to ensure data is saved
    console.log(`📤 [Vectara] Uploading session (${this.conversationEntries.length} entries)`);
    this.uploadFullSession();

    // Clear pending user action
    this.pendingUserAction = null;
  }

  /**
   * Log a system event
   */
  logSystemEvent(event: string): void {
    const entry: ConversationEntry = {
      timestamp: new Date(),
      systemEvent: event
    };

    this.conversationEntries.push(entry);

    console.log(`⚙️ [Vectara] System event logged: ${event}`);
  }

  /**
   * Upload a conversation entry to Vectara (DEPRECATED - now only using batch upload)
   */
  private async uploadToVectara(entry: ConversationEntry): Promise<void> {
    // This method is deprecated - we now only upload the full session at once
    console.log('⚠️  [Vectara] Single-entry upload is disabled. Use uploadFullSession() instead.');
    return;

    /* DEPRECATED CODE - kept for reference
    const uploadStartTime = Date.now();

    try {
      // Format the text section
      let sectionText = '';
      const timestamp = entry.timestamp.toLocaleTimeString();

      if (entry.userAction && entry.tutorResponse) {
        sectionText = `User Action: ${entry.userAction}\nTutor Response: ${entry.tutorResponse}`;
      } else if (entry.tutorResponse) {
        sectionText = `Tutor Response: ${entry.tutorResponse}`;
      } else if (entry.systemEvent) {
        sectionText = `System Event: ${entry.systemEvent}`;
      }

      // Create metadata
      const metadata: any = {
        sessionId: this.sessionId,
        day: this.day,
        timestamp: timestamp,
        component: this.componentName
      };

      if (entry.userAction) {
        metadata.userAction = entry.userAction;
      }
      if (entry.tutorResponse) {
        metadata.tutorResponse = entry.tutorResponse;
      }
      if (entry.systemEvent) {
        metadata.systemEvent = entry.systemEvent;
      }

      // Prepare Vectara payload
      // Note: customerId and corpusId go in the body, not just headers
      const payload = {
        customerId: this.config.customerId,
        corpusId: this.config.corpusId,
        document: {
          documentId: this.sessionId,
          title: `Piano Session ${this.sessionId} - ${this.day}`,
          section: [
            {
              text: sectionText,
              metadataJson: JSON.stringify(metadata)
            }
          ]
        }
      };

      // Comprehensive logging
      console.log('\n' + '='.repeat(80));
      console.log('📤 [Vectara Upload] Starting upload...');
      console.log('⏰ Timestamp:', new Date().toISOString());
      console.log('📄 Document ID:', this.sessionId);
      console.log('📝 Text Length:', sectionText.length, 'characters');
      console.log('🔑 Customer ID:', this.config.customerId);
      console.log('📚 Corpus ID:', this.config.corpusId);
      console.log('📦 Full Payload:', JSON.stringify(payload, null, 2));
      console.log('='.repeat(80) + '\n');

      // Send to Vectara
      console.log('🌐 [Vectara] Sending HTTP POST to https://api.vectara.io/v1/index');
      console.log('🔑 Headers being sent:');
      console.log('   - Content-Type: application/json');
      console.log('   - customer-id:', this.config.customerId);
      console.log('   - x-api-key:', this.config.apiKey.substring(0, 10) + '...');

      const response = await fetch('https://api.vectara.io/v1/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'customer-id': String(this.config.customerId),
          'x-api-key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      const uploadDuration = Date.now() - uploadStartTime;

      console.log('\n' + '='.repeat(80));
      console.log('📥 [Vectara Response] Received response');
      console.log('⏱️  Duration:', uploadDuration, 'ms');
      console.log('📊 Status:', response.status, response.statusText);
      console.log('🌐 URL:', response.url);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [Vectara] SUCCESS! Upload completed');
        console.log('📋 Response Data:', JSON.stringify(result, null, 2));
        console.log('='.repeat(80) + '\n');
      } else {
        const errorText = await response.text();
        console.log('❌ [Vectara] FAILED! Upload error');
        console.log('🔴 Status Code:', response.status);
        console.log('📄 Error Response:', errorText);

        // Try to parse as JSON for better readability
        try {
          const errorJson = JSON.parse(errorText);
          console.log('🔍 Parsed Error:', JSON.stringify(errorJson, null, 2));
        } catch (e) {
          console.log('📝 Raw Error Text:', errorText);
        }

        console.log('📦 Failed Payload:', JSON.stringify(payload, null, 2));
        console.log('='.repeat(80) + '\n');
      }
    } catch (error) {
      const uploadDuration = Date.now() - uploadStartTime;
      console.log('\n' + '='.repeat(80));
      console.log('❌ [Vectara] EXCEPTION! Network or system error');
      console.log('⏱️  Failed after:', uploadDuration, 'ms');
      console.log('🔴 Error Type:', error instanceof Error ? error.name : typeof error);
      console.log('💬 Error Message:', error instanceof Error ? error.message : String(error));
      console.log('📚 Stack Trace:', error instanceof Error ? error.stack : 'N/A');
      console.log('='.repeat(80) + '\n');
    }
    */
  }

  /**
   * Get session information
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      day: this.day,
      componentName: this.componentName,
      entryCount: this.conversationEntries.length
    };
  }

  /**
   * Upload entire session as a single document (batch upload - called on component unmount)
   */
  async uploadFullSession(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('📤 [Vectara] UPLOADING FULL SESSION TO VECTARA');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📝 Total conversation entries:', this.conversationEntries.length);
    console.log('='.repeat(80) + '\n');

    if (this.conversationEntries.length === 0) {
      console.log('⚠️ [Vectara] No entries to upload');
      return;
    }

    try {
      // Create sections from all entries
      const sections = this.conversationEntries.map(entry => {
        let sectionText = '';
        const timestamp = entry.timestamp.toLocaleTimeString();

        if (entry.userAction && entry.tutorResponse) {
          sectionText = `User Action: ${entry.userAction}\nTutor Response: ${entry.tutorResponse}`;
        } else if (entry.tutorResponse) {
          sectionText = `Tutor Response: ${entry.tutorResponse}`;
        } else if (entry.systemEvent) {
          sectionText = `System Event: ${entry.systemEvent}`;
        }

        const metadata: any = {
          sessionId: this.sessionId,
          day: this.day,
          timestamp: timestamp,
          component: this.componentName
        };

        if (entry.userAction) metadata.userAction = entry.userAction;
        if (entry.tutorResponse) metadata.tutorResponse = entry.tutorResponse;
        if (entry.systemEvent) metadata.systemEvent = entry.systemEvent;

        return {
          text: sectionText,
          metadataJson: JSON.stringify(metadata)
        };
      });

      const payload = {
        customerId: this.config.customerId,
        corpusId: this.config.corpusId,
        document: {
          documentId: this.sessionId,
          title: `Piano Session ${this.sessionId} - ${this.day}`,
          section: sections
        }
      };

      console.log('📤 [Vectara] Uploading full session:', JSON.stringify(payload, null, 2));

      const response = await fetch('https://api.vectara.io/v1/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'customer-id': String(this.config.customerId),
          'x-api-key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ [Vectara] Full session uploaded (${this.conversationEntries.length} entries). Response:`, result);
      } else {
        const errorText = await response.text();
        console.error('❌ [Vectara] Full session upload failed:', response.status, errorText);
        console.error('Failed payload was:', JSON.stringify(payload, null, 2));
      }
    } catch (error) {
      console.error('❌ [Vectara] Full session upload error:', error);
    }
  }
}

export default VectaraLogger;
