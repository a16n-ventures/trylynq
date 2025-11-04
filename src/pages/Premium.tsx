import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Crown, Zap, Star, Users, TrendingUp, Shield, ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Load Flutterwave script
const loadFlutterwaveScript = () => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && document.getElementById('flutterwave-script')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'flutterwave-script';
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Flutterwave script'));
    document.body.appendChild(script);
  });
};

const Premium = () => {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    loadFlutterwaveScript()
      .then(() => setScriptLoaded(true))
      .catch(() => toast.error('Failed to load payment system'));
  }, []);

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

  const initializeFlutterwave = (amount: number, description: string) => {
    // @ts-ignore - Flutterwave is loaded via script
    if (typeof FlutterwaveCheckout === 'undefined') {
      toast.error('Payment system not loaded. Please refresh and try again.');
      return;
    }

    // @ts-ignore
    FlutterwaveCheckout({
      public_key: "FLWPUBK_TEST-SANDBOXDEMOKEY-X",
      tx_ref: "lynq-" + Date.now(),
      amount: amount,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd",
      customer: {
        email: "user@lynqapp.com",
        name: "Lynq User",
      },
      customizations: {
        title: "Lynq Premium",
        description: description,
        logo: "https://your-logo-url.com/logo.png",
      },
      callback: function(payment: any) {
        console.log("Payment successful:", payment);
        toast.success("Payment successful! Your premium features are now active.");
      },
      onclose: function() {
        console.log("Payment cancelled");
        toast.info("Payment cancelled");
      },
    });
  };

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

  const PremiumCard = ({ feature }) => (
    <Card className="gradient-card shadow-card border-0 relative overflow-hidden">
      <div className="absolute top-4 right-4">
        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black">
          Popular
        </Badge>
      </div>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="gradient-primary text-white w-12 h-12 rounded-xl flex items-center justify-center">
            {feature.icon}
          </div>
          <div>
            <CardTitle className="heading-md">{feature.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">
              ₦{billingPeriod === 'monthly' ? feature.price.monthly.toLocaleString() : feature.price.yearly.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              /{billingPeriod === 'monthly' ? 'month' : 'year'}
            </span>
          </div>
          {billingPeriod === 'yearly' && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Save 30%
            </Badge>
          )}
        </div>
        <Button 
          className="w-full gradient-primary text-white"
          onClick={() => initializeFlutterwave(
            billingPeriod === 'monthly' ? feature.price.monthly : feature.price.yearly,
            feature.title
          )}
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
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="gradient-primary text-white w-12 h-12 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="heading-lg">Lynq Premium</CardTitle>
                <p className="text-muted-foreground">Everything you need to connect better</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold">
                  ₦{billingPeriod === 'monthly' ? '2,499' : '19,999'}
                </span>
                <span className="text-muted-foreground">
                  /{billingPeriod === 'monthly' ? 'month' : 'year'}
                </span>
              </div>
              {billingPeriod === 'yearly' && (
                <Badge className="bg-green-100 text-green-800">Save 35%</Badge>
              )}
            </div>
          </CardHeader>
          
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
            >
              <Crown className="w-5 h-5 mr-2" />
              Upgrade to Premium
            </Button>
            
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Cancel anytime • 7-day free trial • Secure payment via Flutterwave
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Information */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Event Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">How Event Revenue Works</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• 2% platform fee on all ticket sales</p>
                <p>• Secure payment processing via Flutterwave</p>
                <p>• Automatic payouts within 2 business days</p>
                <p>• Built-in fraud protection and refund management</p>
              </div>
            </div>
            <div className="text-center">
              <Button variant="outline" className="w-full">
                View Revenue Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Premium;