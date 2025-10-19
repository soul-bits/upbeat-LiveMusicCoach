import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Music,
  Video,
  Hand,
  Brain,
  Clock,
  Target,
  Star,
  Sparkles,
  Play,
  ArrowRight,
  CheckCircle,
  Users,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

// Global constants
const DEMO_LINK = "https://www.youtube.com/watch?v=fJy26OKglcA";

interface LandingPageProps {
  onStartPlaying: () => void;
}

export function LandingPage({
  onStartPlaying,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-r from-cyan-400/20 to-teal-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-emerald-400/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-xl sticky top-0 z-50 bg-slate-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <Music className="w-10 h-10 text-cyan-400" />
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Music For All</h1>
              <p className="text-sm text-slate-300">
                by <span className="text-cyan-400 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>#</span>
                <span className="text-slate-400 font-semibold" style={{ fontFamily: 'Brush Script MT, cursive' }}>Soul</span>
                <span className="text-cyan-400 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Bits</span>
              </p>
            </div>
          </motion.div>
          <nav className="hidden md:flex items-center gap-8">
            {['Features', 'Demo', 'About', 'Contact'].map((item, index) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-slate-300 hover:text-cyan-400 transition-colors font-medium"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                {item}
              </motion.a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="container mx-auto px-4 py-20 md:py-32 relative z-10"
        id="home"
      >
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Badge className="mb-6 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30 px-4 py-2 text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Powered Music Learning for Everyone
              </Badge>
            </motion.div>
            
            <motion.h1
              className="text-5xl md:text-7xl font-bold mb-6 text-white leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Learn Music{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Anywhere, Anytime
              </span>{" "}
              With AI
            </motion.h1>
            
            <motion.p
              className="text-xl text-slate-300 mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Access world-class music education from anywhere with your personal AI instructor.
              Real-time feedback, adaptive learning, and personalized guidance—music made accessible for everyone.
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <Button
                onClick={onStartPlaying}
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Playing Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.open(DEMO_LINK, '_blank')}
                className="border-2 border-slate-400 text-slate-300 hover:border-cyan-400 hover:text-cyan-400 px-8 py-4 text-lg transition-all duration-300"
              >
                <Video className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </motion.div>


          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 30 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-blue-900/50 backdrop-blur-sm">
              <ImageWithFallback
                src="https://d30pueezughrda.cloudfront.net/roli.com/storyblok/blog_5_-_techniques.72042675717560.jpg"
                alt="Piano keys"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
              
              {/* Floating AI Status */}
              <motion.div
                className="absolute top-6 right-6 bg-gradient-to-r from-cyan-500/90 to-blue-600/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-white font-medium text-sm">AI Tutor Active</p>
                </div>
              </motion.div>

              {/* Floating Features */}
              <motion.div
                className="absolute bottom-6 left-6 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 shadow-xl"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <p className="text-white text-sm">Real-time Feedback</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <Card className="p-12 bg-gradient-to-br from-slate-800/80 to-blue-900/80 backdrop-blur-xl border-white/10 shadow-2xl">
            <motion.div
              initial={{ scale: 0.9 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Music className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
              <p className="text-2xl text-white leading-relaxed font-light">
                "Music education should be accessible to everyone, everywhere.{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-semibold">
                  Music For All
                </span>{" "}
                brings AI-powered instruction to you—real-time feedback, anytime you need it."
              </p>
              <div className="mt-8 flex justify-center items-center gap-4">
                <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-cyan-400"></div>
                <Star className="w-5 h-5 text-yellow-400" />
                <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-cyan-400"></div>
              </div>
            </motion.div>
          </Card>
        </motion.div>
      </section>

      {/* Features Section */}
      <section
        className="container mx-auto px-4 py-24 relative z-10"
        id="features"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Badge className="mb-6 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30 px-4 py-2 text-sm font-medium">
            <Star className="w-4 h-4 mr-2" />
            Why Music For All?
          </Badge>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white">
            Advanced AI Technology Meets{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Personalized Learning
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Experience the future of music education with cutting-edge AI that adapts to your unique learning style—accessible to everyone, anywhere
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {[
            {
              icon: Video,
              title: "Real-Time Video Analysis",
              description: "Our AI watches your hands and provides instant feedback on finger placement and posture.",
              gradient: "from-cyan-500 to-blue-600",
              bgGradient: "from-cyan-500/10 to-blue-600/10",
            },
            {
              icon: Hand,
              title: "Finger Guidance Overlays",
              description: "Visual overlays show you exactly where your fingers should be, making learning intuitive.",
              gradient: "from-blue-500 to-indigo-600",
              bgGradient: "from-blue-500/10 to-indigo-600/10",
            },
            {
              icon: Brain,
              title: "Personalized AI Instructors",
              description: "Choose from unique instructors with distinct teaching personalities that adapt to your learning style.",
              gradient: "from-yellow-500 to-orange-600",
              bgGradient: "from-yellow-500/10 to-orange-600/10",
            },
            {
              icon: Clock,
              title: "Learn On Your Schedule",
              description: "Practice anytime, anywhere with your AI instructor always available when you are.",
              gradient: "from-emerald-500 to-teal-600",
              bgGradient: "from-emerald-500/10 to-teal-600/10",
            },
            {
              icon: Target,
              title: "Auto-Generated Drills",
              description: "AI creates custom practice exercises based on your specific mistakes and progress.",
              gradient: "from-red-500 to-orange-600",
              bgGradient: "from-red-500/10 to-orange-600/10",
            },
            {
              icon: Music,
              title: "Instant Audio Feedback",
              description: "Real-time audio cues help you stay in tempo and play the correct notes.",
              gradient: "from-teal-500 to-cyan-600",
              bgGradient: "from-teal-500/10 to-cyan-600/10",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
            >
              <Card className="p-8 h-full bg-gradient-to-br from-slate-800/80 to-blue-900/80 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-2xl group">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.bgGradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className={`w-8 h-8 text-white`} />
                                </div>
                <h3 className="text-xl font-bold text-white mb-4 group-hover:text-cyan-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-6 flex items-center text-cyan-400 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  Learn More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>


      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <Card className="p-12 mt-16 bg-gradient-to-br from-slate-800/80 to-blue-900/80 backdrop-blur-xl border-white/10 shadow-2xl">
            <motion.div
              initial={{ scale: 0.95 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Badge className="mb-6 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30 px-4 py-2 text-sm font-medium">
                <CheckCircle className="w-4 h-4 mr-2" />
                Ready to Start?
              </Badge>
              
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white">
                Start Your Music Journey{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Today
                </span>
              </h2>

              <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                Join thousands learning music with personalized AI instruction—accessible to everyone, anywhere, anytime
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <Button
                  onClick={onStartPlaying}
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Learning Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-5 h-5" />
                  <span className="text-sm">Join 10,000+ students</span>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap justify-center items-center gap-8 text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm">Free to start</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm">No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm">Cancel anytime</span>
                </div>
              </div>
            </motion.div>
          </Card>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 mt-20 relative z-10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Music className="w-8 h-8 text-cyan-400" />
                <div>
                  <h3 className="text-xl font-bold text-white">Music For All</h3>
                  <p className="text-sm text-slate-400">AI Music Learning</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm">
                Music education accessible to everyone, anywhere, anytime with AI-powered instruction.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors" onClick={() => window.open(DEMO_LINK, '_blank')}>Demo</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Tutorials</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Community</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Status</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-slate-400 text-sm">
              &copy; 2025 Music For All by{" "}
              <span className="text-cyan-400 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>#</span>
              <span className="text-slate-400 font-semibold" style={{ fontFamily: 'Brush Script MT, cursive' }}>Soul</span>
              <span className="text-cyan-400 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Bits</span>.
              Making music accessible for everyone, everywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
