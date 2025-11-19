import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Crown, Zap, Star, TrendingUp, ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext'; 
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 

// --- Type definitions ---
declare global {
  interface Window {
    FlutterwaveCheckout?: (options: any) => void;
  }
}

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

const FLUTTERWAVE_PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY;

const Premium = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); 
  const queryClient = useQueryClient(); 
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1. Dynamic Data Fetching ---
  // This pulls the prices you set in the Admin Dashboard
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');
      if (error) throw error;
      return data;
    }
  });

  // --- 2. Data Parsing (With Defaults) ---
  const pricing = useMemo(() => {
    const remotePrice = settings?.find(s => s.key === 'premium_prices')?.value;
    return {
      monthly: remotePrice?.monthly || 2499, // Default fallback
      yearly: remotePrice?.yearly || 19999   // Default fallback
    };
  }, [settings]);

  useEffect(() => {
    if (!FLUTTERWAVE_PUBLIC_KEY) {
      console.error("Flutterwave public key is missing");
      return;
    }
    loadFlutterwaveScript()
      .then(() => setScriptLoaded(true))
      .catch(() => toast.error('Failed to load payment system'));
  }, []);

  // Hardcoded "Single Upgrade" features (You can move these to DB later if needed)
  const premiumFeatures = [
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

  const handlePayment = (amount: number, title: string) => {
    if (!scriptLoaded || !FLUTTERWAVE_PUBLIC_KEY) {
      toast.error('Payment system loading... please wait.');
      return;
    }
    if (!user) {
      toast.error('Please log in to continue.');
      navigate('/login');
      return;
    }

    setIsProcessing(true);
    const tx_ref = `lynq-${user.id}-${Date.now()}`;

    const config = {
      public_key: FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: tx_ref,
      amount: amount,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd",
      customer: {
        email: user.email || "user@lynqapp.com",
        name: user.email || "Lynq User",
      },
      customizations: {
        title: "Lynq Premium",
        description: `Upgrade to ${title}`,
        logo: "https://lynq.app/logo.png",
      },
      callback: async function(response: any) {
        const toastId = toast.loading("Verifying transaction...");
        try {
          const { data, error } = await supabase.functions.invoke('verify-payment', {
            body: { 
              transaction_id: response.transaction_id, 
              tx_ref: response.tx_ref,
              expected_amount: amount
            },
          });

          if (error) throw error;

          if (data?.status === 'success') {
            toast.success("Upgrade successful! Welcome to Premium.", { id: toastId });
            await queryClient.invalidateQueries({ queryKey: ['profile'] });
            setTimeout(() => navigate('/app/profile'), 1500);
          } else {
            throw new Error(data?.message || "Verification failed");
          }
        } catch (err: any) {
          console.error("Payment verification error:", err);
          toast.error("Payment verification failed. Please contact support.", { id: toastId });
        } finally {
          setIsProcessing(false);
        }
      },
      onclose: function() {
        setIsProcessing(false);
      }
    };

    window.FlutterwaveCheckout && window.FlutterwaveCheckout(config);
  };

  // Calculate savings
  const yearlySavings = Math.round(pricing.monthly * 12 - pricing.yearly);
  const savingsPercent = Math.round((yearlySavings / (pricing.monthly * 12)) * 100);

  const PremiumCard = ({ feature }: { feature: (typeof premiumFeatures)[0] }) => (
    <Card className="gradient-card shadow-card border-0 relative overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="gradient-primary text-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
            {feature.icon}
          </div>
          <div>
            <CardTitle className="text-base font-bold">{feature.title}</CardTitle>
            <p className="text-xs text-muted-foreground leading-tight">{feature.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between border-t border-border/50 pt-3">
          <div>
            <span className="text-xl font-bold">
              ₦{billingPeriod === 'monthly' ? feature.price.monthly.toLocaleString() : feature.price.yearly.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
            </span>
          </div>
          {billingPeriod === 'yearly' && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px] px-1.5 h-5">
              -30%
            </Badge>
          )}
        </div>
        <Button 
          className="w-full gradient-primary text-white shadow-sm h-9 text-sm"
          onClick={() => handlePayment(
            billingPeriod === 'monthly' ? feature.price.monthly : feature.price.yearly,
            feature.title
          )}
          disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          Get Started
        </Button>
      </CardContent>
    </Card>
  );

  if (isLoadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/20 -ml-2"
              onClick={() => navigate('/app')}
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold">Premium</h1>
          </div>
          <p className="text-white/80 text-sm mb-4">Upgrade your social life with Lynq Premium.</p>
        </div>
      </div>

      <div className="container-mobile -mt-4 relative z-10 space-y-6">
        
        {/* Billing Toggle */}
        <div className="bg-card rounded-xl p-1.5 flex items-center shadow-sm border relative">
          <div 
            className={`flex-1 py-2 text-center text-sm font-medium rounded-lg cursor-pointer transition-all ${billingPeriod === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setBillingPeriod('monthly')}
          >
            Monthly
          </div>
          <div 
            className={`flex-1 py-2 text-center text-sm font-medium rounded-lg cursor-pointer transition-all relative ${billingPeriod === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setBillingPeriod('yearly')}
          >
            Yearly
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
              SAVE {savingsPercent}%
            </span>
          </div>
        </div>

        {/* Best Value Card (Uses Dynamic Pricing) */}
        <Card className="border-primary/50 shadow-lg relative overflow-hidden bg-gradient-to-br from-background to-primary/5">
           <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl">
             BEST VALUE
           </div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Crown className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Lynq Unlimited</CardTitle>
                <p className="text-xs text-muted-foreground">All features included</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {fullPremiumFeatures.slice(0, 4).map((f, i) => (
                 <div key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                   <Check className="w-4 h-4 text-green-500 shrink-0" />
                   {f}
                 </div>
              ))}
              <div className="text-xs text-muted-foreground italic pl-6">+ 4 more exclusive features</div>
            </div>

            <div className="pt-4 border-t border-border/50">
               <div className="flex items-end justify-between mb-3">
                 <div>
                   <span className="text-3xl font-bold tracking-tight">
                     ₦{billingPeriod === 'monthly' ? pricing.monthly.toLocaleString() : pricing.yearly.toLocaleString()}
                   </span>
                   <span className="text-sm text-muted-foreground">/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
                 </div>
                 {billingPeriod === 'yearly' && (
                   <div className="text-right">
                     <div className="text-xs text-muted-foreground line-through">
                       ₦{(pricing.monthly * 12).toLocaleString()}
                     </div>
                     <div className="text-xs font-bold text-green-600">Save ₦{yearlySavings.toLocaleString()}</div>
                   </div>
                 )}
               </div>
               <Button 
                  className="w-full gradient-primary text-white h-11 shadow-md"
                  onClick={() => handlePayment(
                    billingPeriod === 'monthly' ? pricing.monthly : pricing.yearly,
                    'Lynq Unlimited'
                  )}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Unlimited Access"}
                </Button>
            </div>
          </CardContent>
        </Card>

        {/* À la carte Features (Currently Hardcoded - Roadmap Item) */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground ml-1">SINGLE UPGRADES</h3>
          {premiumFeatures.map((feature, index) => (
            <PremiumCard key={index} feature={feature} />
          ))}
        </div>

        {/* Trust Footer */}
        <div className="text-center space-y-2 pb-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
             <AlertCircle className="w-4 h-4" />
             <span className="text-xs">Secure payments processed by Flutterwave</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Subscriptions auto-renew. Cancel anytime in settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Premium;
    
