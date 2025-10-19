# Upbeat - Accessible Music Education For All

An AI-powered music learning platform that makes music education accessible to everyone, anywhere, anytime. Built on Google's Gemini AI, it offers real-time, personalized instruction that adapts to your skill level and learning pace, breaking down barriers to music education.

## Project Description

**Upbeat** is a revolutionary AI-powered music education platform that democratizes access to quality music instruction. Using advanced computer vision and real-time audio processing, the platform provides personalized piano tutoring that can see your hands, hear your playing, and offer instant feedback—just like having a personal music teacher available 24/7.

The platform features interactive avatars with unique personalities (inspired by Harry Potter characters), real-time visual feedback, and step-by-step song teaching that adapts to each learner's pace and skill level.

## Problem

Traditional music education faces significant barriers:

- **Geographic Limitations**: Quality music teachers are often concentrated in urban areas, leaving rural communities underserved
- **Cost Barriers**: Private music lessons can cost $50-100+ per hour, making them inaccessible to many families
- **Scheduling Constraints**: Fixed lesson times don't accommodate busy schedules or different time zones
- **Limited Availability**: There's a shortage of qualified music teachers, especially for specialized instruments
- **One-Size-Fits-All Approach**: Traditional lessons don't adapt to individual learning styles and paces
- **Lack of Real-Time Feedback**: Students often practice alone without immediate guidance on technique or mistakes

## Solution

**Upbeat** addresses these challenges through:

### 🎯 **AI-Powered Personalization**
- Real-time computer vision that watches your hand positioning and finger placement
- Audio analysis that detects pitch accuracy, rhythm, and timing
- Adaptive teaching that adjusts to your learning pace and skill level
- Personalized feedback based on your specific mistakes and progress

### 🌍 **Universal Accessibility**
- Works anywhere with internet connection and a camera
- Available 24/7 - learn at your own schedule
- No geographic limitations - bring world-class instruction to any location
- Free to use with just a Google AI API key

### 👥 **Engaging Learning Experience**
- Interactive avatars with unique personalities and teaching styles
- Step-by-step song breakdown (4-8 notes at a time)
- Visual and audio feedback in real-time
- Encouraging, patient instruction that celebrates small wins

### 🎵 **Comprehensive Music Education**
- Teaches proper hand positioning and finger placement
- Breaks down songs into manageable parts
- Covers both right and left hand techniques
- Provides specific feedback on technique and accuracy

## Social Impact

**Upbeat** is transforming music education accessibility worldwide:

### 🌟 **Democratizing Music Education**
- **Breaking Economic Barriers**: Eliminates the $50-100/hour cost of private lessons, making quality music education accessible to families regardless of income
- **Bridging Geographic Gaps**: Brings expert instruction to rural areas, developing countries, and underserved communities where music teachers are scarce
- **Supporting Underserved Populations**: Provides equal access to music education for students with disabilities, those in remote locations, and families who cannot afford traditional lessons

### 🎓 **Educational Equity**
- **24/7 Availability**: Students can learn at any time, accommodating different schedules, time zones, and learning preferences
- **Personalized Learning**: Adapts to individual learning styles, ensuring no student is left behind due to a one-size-fits-all approach
- **Consistent Quality**: Provides the same high-quality instruction regardless of location or economic status

### 🌍 **Global Reach**
- **Language Accessibility**: AI instruction can be adapted for different languages and cultural contexts
- **Scalable Impact**: Can serve unlimited students simultaneously, unlike traditional one-on-one teaching
- **Cultural Preservation**: Helps preserve musical traditions by making instruction accessible to communities worldwide

### 💡 **Innovation in Education**
- **Technology Integration**: Demonstrates how AI can enhance rather than replace human creativity and learning
- **Future-Ready Skills**: Teaches students to work with AI tools while developing traditional musical skills
- **Inspiration for Other Fields**: Shows how AI can democratize access to specialized education in other domains

## Tech Stack

### **Google AI Studio & Gemini APIs**
- **Gemini 2.0 Flash Experimental**: Real-time multimodal AI for live video and audio processing
- **Gemini 2.5 Flash**: Text generation for chat responses and avatar personality conversion
- **Gemini Live API**: WebSocket-based real-time communication for live instruction
- **Google AI Studio**: Model configuration and system instruction management

### **Core Technologies**
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4 with PostCSS
- **UI Components**: Custom components with Lucide React icons
- **State Management**: React Context API
- **Animation**: Motion (Framer Motion) for smooth transitions

### **Audio & Video Processing**
- **WebRTC**: Real-time camera and microphone access
- **Canvas API**: Video frame capture and processing
- **Web Audio API**: Audio analysis and note detection
- **Custom Note Detection**: JavaScript-based pitch and rhythm analysis

### **Data & Storage**
- **Vectara**: Vector database for session history and RAG (Retrieval-Augmented Generation)
- **Local Storage**: Session persistence and user preferences
- **Environment Variables**: Secure API key management

## Partner Technologies Used

### **ElevenLabs**
- **Text-to-Speech**: High-quality voice synthesis for avatar interactions
- **Voice Cloning**: Custom voice generation for different avatar personalities
- **Multilingual Support**: `eleven_multilingual_v2` model for international accessibility
- **Audio Format**: MP3 output at 44.1kHz for optimal quality

### **Vectara**
- **Vector Search**: Semantic search through learning session history
- **RAG Implementation**: Retrieval-Augmented Generation for contextual responses
- **Session Analytics**: Tracking learning progress and patterns
- **Knowledge Base**: Storing and retrieving educational content

### **Web Standards & APIs**
- **WebSocket API**: Real-time bidirectional communication with Gemini Live
- **MediaDevices API**: Camera and microphone access
- **Canvas 2D API**: Video frame processing and analysis
- **Web Audio API**: Real-time audio processing and analysis
- **Fetch API**: HTTP requests to various services

### **Development Tools**
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **PostCSS**: CSS processing and optimization
- **ESLint/Prettier**: Code quality and formatting
- **Git**: Version control and collaboration
