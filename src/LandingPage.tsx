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
} from "lucide-react";
import { motion } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface LandingPageProps {
  onStartPlaying: () => void;
}

export function LandingPage({
  onStartPlaying,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900">
      {/* Header */}
      <header className="border-b border-white/20 backdrop-blur-sm sticky top-0 z-50 bg-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-8 h-8 text-yellow-400" />
            <div>
              <h1 className="text-xl text-white">Upbeat</h1>
              <p className="text-xs text-purple-300">
                by <span className="brand-bits">#</span>
                <span className="brand-soul">Soul</span>
                <span className="brand-bits">Bits</span>
              </p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="#home"
              className="text-white/80 hover:text-yellow-400 transition-colors"
            >
              Home
            </a>
            <a
              href="#features"
              className="text-white/80 hover:text-yellow-400 transition-colors"
            >
              Features
            </a>
            <a
              href="#demo"
              className="text-white/80 hover:text-yellow-400 transition-colors"
            >
              Demo
            </a>
            <a
              href="#about"
              className="text-white/80 hover:text-yellow-400 transition-colors"
            >
              About
            </a>
            <a
              href="#contact"
              className="text-white/80 hover:text-yellow-400 transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="container mx-auto px-4 py-20 md:py-32"
        id="home"
      >
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-4 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              AI-Powered Piano Learning
            </Badge>
            <h1 className="text-4xl md:text-6xl mb-6 text-white">
              Your Personal Piano Coach in Real-Time
            </h1>
            <p className="text-xl text-purple-300 mb-8">
              Master the piano with instant feedback from your
              AI tutor. No more guessing—just play, learn, and
              improve.
            </p>
            <Button
              onClick={onStartPlaying}
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              Start Playing Now
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary/20">
              <ImageWithFallback
                src="https://d30pueezughrda.cloudfront.net/roli.com/storyblok/blog_5_-_techniques.72042675717560.jpg"
                alt="Piano keys"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <motion.div
                className="absolute top-4 right-4 bg-primary/90 backdrop-blur-sm rounded-lg px-4 py-2"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <p className="text-primary-foreground">
                  AI Tutor Active
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <Card className="p-8 bg-white/90 backdrop-blur-lg border-white/20">
            <p className="text-xl text-black leading-relaxed">
              "Learning piano is magical but tricky.{" "}
              <span className="text-purple-600">Upbeat</span>{" "}
              guides you in real-time, so mistakes are corrected
              instantly."
            </p>
          </Card>
        </motion.div>
      </section>

      {/* Features Section */}
      <section
        className="container mx-auto px-4 py-20"
        id="features"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl mb-4 text-white">
            Why Choose Upbeat?
          </h2>
          <p className="text-xl text-purple-300">
            Advanced AI technology meets personalized music
            education
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Video,
              title: "Real-Time Video Analysis",
              description:
                "Our AI watches your hands and provides instant feedback on finger placement and posture.",
              color: "text-chart-1",
            },
            {
              icon: Hand,
              title: "Finger Guidance Overlays",
              description:
                "Visual overlays show you exactly where your fingers should be, making learning intuitive.",
              color: "text-chart-2",
            },
            {
              icon: Brain,
              title: "Personalized AI Tutors",
              description:
                "Choose from unique tutors with distinct personalities—Snape, Sheldon, or Phoebe.",
              color: "text-chart-3",
            },
            {
              icon: Clock,
              title: "Practice Reminders",
              description:
                "Your tutor reminds you to practice, keeping you motivated and on track.",
              color: "text-chart-4",
            },
            {
              icon: Target,
              title: "Auto-Generated Drills",
              description:
                "AI creates custom practice exercises based on your specific mistakes and progress.",
              color: "text-chart-5",
            },
            {
              icon: Music,
              title: "Instant Audio Feedback",
              description:
                "Real-time audio cues help you stay in tempo and play the correct notes.",
              color: "text-primary",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 h-full bg-white/90 backdrop-blur-lg border-white/20 hover:border-yellow-400/50 transition-all hover:shadow-lg hover:shadow-yellow-400/10">
                <feature.icon
                  className={`w-12 h-12 mb-4 ${feature.color}`}
                />
                <h3 className="mb-3 text-black">{feature.title}</h3>
                <p className="text-gray-700">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Demo Video Section */}
      <section
        className="container mx-auto px-4 py-20"
        id="demo"
      >
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl mb-4 text-white">
            See Upbeat in Action
          </h2>
          <p className="text-xl text-purple-300">
            Watch how our AI tutor provides real-time
            corrections
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 aspect-video bg-black/20">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1746155885870-ba90e7fcdcbc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBwbGF5aW5nJTIwcGlhbm98ZW58MXx8fHwxNzYwNzAzMzg5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt="Person playing piano"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  className="rounded-full w-20 h-20 bg-yellow-500 hover:bg-yellow-600"
                >
                  <Video className="w-8 h-8 text-black" />
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-5xl mb-6 text-white">
            Ready to Transform Your Piano Journey?
          </h2>
          <p className="text-xl text-purple-300 mb-8">
            Start learning with your personal AI piano coach
            today
          </p>
          <Button
            onClick={onStartPlaying}
            size="lg"
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
          >
            Get Started Now
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/20 py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-purple-300">
          <p>
            &copy; 2025 Upbeat by{" "}
            <span className="brand-bits">#</span>
            <span className="brand-soul">Soul</span>
            <span className="brand-bits">Bits</span>. Built for
            Hackathon.
          </p>
        </div>
      </footer>
    </div>
  );
}
