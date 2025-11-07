import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Users, MessageCircle, Bell, Shield, Sparkles } from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg';
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

  const features = [
    {
      icon: <Users className="w-8 h-8" />,
      title: "Find Your People",
      description: "Discover which friends from your contacts are nearby or in your city"
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Smart Location Sharing",
      description: "Share your location privately with friends - only city or neighborhood level"
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: "Instant Reconnection",
      description: "Start conversations and plan hangouts with friends who are nearby"
    },
    {
      icon: <Bell className="w-8 h-8" />,
      title: "Smart Notifications",
      description: "Get notified when friends from your contacts enter your area"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Privacy First",
      description: "Your exact location is never shared - only general area for privacy"
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Plan Events",
      description: "Create meetups, parties, and sell tickets to friends in your network"
    }
  ];

  const handleAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 gradient-hero opacity-90" />
        
        {/* Hero Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="Lynq - Connect with nearby friends" 
            className="w-full h-full object-cover opacity-20"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 container-mobile text-center text-white">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="heading-display text-white">
                Lynq
              </h1>
              <p className="text-xl opacity-90 max-w-2xl mx-auto leading-relaxed">
                Never lose touch with friends again. Discover who's nearby, reconnect instantly, and plan amazing hangouts.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => handleAuth('signup')}
                className="min-w-[200px] bg-white/20 text-white border-white/30 hover:bg-white/30 transition-smooth shadow-glow"
              >
                Get Started Free
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => handleAuth('login')}
                className="min-w-[200px] bg-transparent text-white border-white/50 hover:bg-white/10 transition-smooth"
              >
                Sign In
              </Button>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container-tablet">
          <div className="text-center mb-16">
            <h2 className="heading-xl mb-4">Why Lynq?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Reconnect with your existing friends based on location. No strangers, no dating - just real connections with people you already know.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="gradient-card shadow-card border-0 transition-smooth hover:shadow-primary hover:-translate-y-1">
                <CardContent className="p-8 text-center">
                  <div className="gradient-primary text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-primary">
                    {feature.icon}
                  </div>
                  <h3 className="heading-lg mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 container-tablet text-center text-white">
          <div className="space-y-8">
            <h2 className="heading-xl">Ready to reconnect?</h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Join thousands of people who are rediscovering friendships and creating new memories with people nearby.
            </p>
            <div className="flex items-center justify-center gap-8 text-white text-sm opacity-75">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Privacy Protected</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Friends Only</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>100% Free</span>
              </div>
            </div>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => handleAuth('signup')}
              className="min-w-[200px] bg-white text-primary hover:bg-white/90 transition-smooth shadow-glow"
            >
              Start Connecting Now
            </Button>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
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
