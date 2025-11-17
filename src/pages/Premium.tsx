import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Crown, Zap, Star, TrendingUp, ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext'; 
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query'; 

// --- Type definitions ---
// This allows window.FlutterwaveCheckout to be recognized by TypeScript
declare global {
  interface Window {
    FlutterwaveCheckout?: (options: any) => void;
  }
}

// --- Helper to load Flutterwave script ---
const loadFlutterwaveScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById('flutterwave-script')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'flutterwave-script';
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Flutterwave script'));
    document.body.appendChild(script);
  });
};

// --- Environment Variable ---
// 1. Get Public Key from .env
//    Your .env file must contain:
//    VITE_FLUTTERWAVE_PUBLIC_KEY="YOUR_FLW_PUBLIC_KEY"
const FLUTTERWAVE_PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY;

if (!FLUTTERWAVE_PUBLIC_KEY) {
  console.error("Flutterwave public key is not set in environment variables.");
  toast.error("Payment system is not configured.", { duration: Infinity });
}

const Premium = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // Get user for payment details
  const queryClient = useQueryClient(); // Get query client to refetch user data
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    loadFlutterwaveScript()
      .then(() => setScriptLoaded(true))
      .catch(() => toast.error('Failed to load payment system'));
  }, []);

  const premiumFeatures = [
    // ... (your existing features)
    {
      icon: <Crown className="w-5 h-5" />,
      title: 'Profile Visibility Boost',
      description: 'Get 3x more profile views and friend suggestions',
      price: { monthly: 999, yearly: 9999 }
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Event Promotion',
      description: 'Promote your events to reach more people in your area',
      price: { monthly: 1499, yearly: 14999 }
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: 'Premium Badge',
      description: 'Stand out with a special premium badge on your profile',
      price: { monthly: 599, yearly: 4999 }
    }
  ];

  const fullPremiumFeatures = [
    'Unlimited friend requests',
    'Advanced search filters',
    'Priority customer support',
    'Analytics for your events',
    'Custom profile themes',
    'Ad-free experience',
    'Early access to new features',
    'Enhanced privacy controls'
  ];

  // 2. Refactored payment initialization
  const initializeFlutterwave = (amount: number, description: string) => {
    if (!scriptLoaded || !FLUTTERWAVE_PUBLIC_KEY) {
      toast.error('Payment system not ready. Please try again.');
      return;
    }
    if (!user) {
      toast.error('You must be logged in to make a purchase.');
      return;
    }
    if (!window.FlutterwaveCheckout) {
      toast.error('Payment system failed to load. Please refresh.');
      return;
    }
    
    const tx_ref = "lynq-" + user.id + "-" + Date.now();

    window.FlutterwaveCheckout({
      public_key: FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: tx_ref,
      amount: amount,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd",
      customer: {
        email: user.email || "user@lynqapp.com", // Use user's email
        name: "Lynq User", // TODO: Get from user's profile
      },
      customizations: {
        title: "Lynq Premium",
        description: description,
        logo: "https://your-logo-url.com/logo.png", // TODO: Add your logo URL
      },
      
      // 3. SECURE CALLBACK HANDLER
      callback: async function(payment: any) {
        // This function is called *after* the payment modal closes
        // It does NOT mean the payment was successful yet, just that it's complete.
        
        // Show immediate feedback
        const toastId = toast.loading("Verifying payment, please wait...");

        try {
          // Call our new Edge Function to securely verify the transaction
          const { data, error } = await supabase.functions.invoke('verify-payment', {
            body: { 
              tx_ref: payment.tx_ref,
              expected_amount: amount,
              expected_currency: "NGN"
            },
          });

          if (error) throw error; // Handle function invocation error

          if (data.status === 'success') {
            // SUCCESS! The Edge Function verified and granted premium.
            toast.success("Payment successful! Your premium features are now active.", { id: toastId });
            
            // Invalidate user queries to refetch their profile/auth state
            // This will make the app recognize they are now premium
            await queryClient.invalidateQueries({ queryKey: ['user'] });
            await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
            
            navigate('/app/profile'); // Navigate to profile to see badge
          } else {
            // The Edge Function ran but verification failed (e.g., payment failed)
            throw new Error(data.message || 'Payment verification failed.');
          }

        } catch (err: any) {
          console.error('Verification error:', err);
          toast.error(`Verification failed: ${err.message}`, { id: toastId });
        }
      },
      onclose: function() {
        console.log("Payment modal closed");
        // Only show this if no other toast is active
        if (!toast.isActive('verifying')) {
          toast.info("Payment cancelled");
        }
      },
    });
  };

  // ... (Rest of your component, PremiumCard, etc. No changes needed below)

  const PremiumCard = ({ feature }: { feature: (typeof premiumFeatures)[0] }) => (
    <Card className="gradient-card shadow-card border-0 relative overflow-hidden">
      {/* ... (your card content) ... */}
      <CardContent className="space-y-4">
        {/* ... */}
        <Button 
          className="w-full gradient-primary text-white"
          onClick={() => initializeFlutterwave(
            billingPeriod === 'monthly' ? feature.price.monthly : feature.price.yearly,
            feature.title
          )}
          disabled={!scriptLoaded || !FLUTTERWAVE_PUBLIC_KEY}
        >
          <Zap className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20 p-2"
              onClick={() => navigate('/app')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="heading-lg text-white">Premium Features</h1>
              <p className="opacity-90">Unlock the full potential of Lynq</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-mobile py-6 space-y-6">
        {/* Billing Toggle */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <span className={billingPeriod === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}>
                Monthly
              </span>
              <Switch
                checked={billingPeriod === 'yearly'}
                onCheckedChange={(checked) => setBillingPeriod(checked ? 'yearly' : 'monthly')}
              />
              <span className={billingPeriod === 'yearly' ? 'font-semibold' : 'text-muted-foreground'}>
                Yearly
              </span>
              {billingPeriod === 'yearly' && (
                <Badge className="bg-green-100 text-green-800">30% OFF</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Individual Premium Features */}
        <div className="space-y-4">
          {premiumFeatures.map((feature, index) => (
            <PremiumCard key={index} feature={feature} />
          ))}
        </div>

        {/* Full Premium Package */}
        <Card className="gradient-card shadow-card border-0 relative overflow-hidden">
          {/* ... (your full package card content) ... */}
          <CardContent className="space-y-4 relative">
            <div className="grid grid-cols-2 gap-2">
              {fullPremiumFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            
            <Button 
              className="w-full gradient-primary text-white h-12 text-lg"
              onClick={() => initializeFlutterwave(
                billingPeriod === 'monthly' ? 2499 : 19999,
                'Lynq Premium - Full Package'
              )}
              disabled={!scriptLoaded || !FLUTTERWAVE_PUBLIC_KEY}
            >
              <Crown className="w-5 h-5 mr-2" />
              Upgrade to Premium
            </Button>
            
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Cancel anytime • Secure payment via Flutterwave
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Premium;
    
