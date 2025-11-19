import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Users, MessageCircle, Shield, Sparkles, ArrowRight, Globe } from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg'; // Ensure this image exists or use fallback color
import AuthModal from '@/components/auth/AuthModal';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/app', { replace: true });
    }
  }, [user, navigate]);

  const handleAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  const features = [
    { icon: <Users className="w-6 h-6" />, title: "Social Discovery", desc: "Find friends nearby instantly." },
    { icon: <MapPin className="w-6 h-6" />, title: "Privacy Mode", desc: "Share location on your terms." },
    { icon: <MessageCircle className="w-6 h-6" />, title: "Live Chat", desc: "Seamless real-time messaging." },
    { icon: <Sparkles className="w-6 h-6" />, title: "Events", desc: "Host parties & sell tickets." },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      
      {/* HERO SECTION */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        
        {/* Background Image with Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background z-10" />
          <img 
            src={heroImage} 
            onError={(e) => e.currentTarget.src = 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop'}
            alt="Background" 
            className="w-full h-full object-cover scale-105 animate-slow-zoom"
          />
        </div>

        {/* Content */}
        <div className="relative z-20 container-mobile text-center text-white px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Globe className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-medium tracking-wide">Connecting 10,000+ Users</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Your World, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Connected.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 max-w-xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            The social map that lets you see who's nearby, plan spontaneous hangouts, and discover local events securely.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300">
            <Button 
              size="lg" 
              className="min-w-[200px] h-14 text-lg font-semibold rounded-full gradient-primary text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:shadow-[0_0_30px_rgba(37,99,235,0.7)] transition-all hover:scale-105"
              onClick={() => handleAuth('signup')}
            >
              Join Now - It's Free
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="min-w-[200px] h-14 text-lg font-semibold rounded-full bg-white/5 border-white/20 text-white hover:bg-white/10 backdrop-blur-sm"
              onClick={() => handleAuth('login')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-20 px-4 bg-background">
        <div className="container-mobile">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2">Everything you need</h2>
            <p className="text-muted-foreground">Built for real-life connections.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="border border-border/50 hover:border-primary/50 transition-all hover:shadow-lg group">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-12 bg-muted/30 border-t border-border">
        <div className="container-mobile text-center">
          <h2 className="text-2xl font-bold mb-6">Ready to jump in?</h2>
          <Button variant="link" onClick={() => handleAuth('signup')} className="text-primary text-lg group">
            Create your account <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      <AuthModal 
        open={showAuth} 
        onOpenChange={setShowAuth} 
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </div>
  );
};

export default Index;
        
