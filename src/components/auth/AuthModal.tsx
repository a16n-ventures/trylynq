import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, Eye, EyeOff, Chrome, Facebook } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
}

const AuthModal = ({ open, onOpenChange, mode, onModeChange }: AuthModalProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show demo message since we don't have Supabase yet
    toast({
      title: "Demo Mode",
      description: "Connect to Supabase to enable authentication. This is a beautiful UI preview!",
      duration: 3000
    });
  };

  const handleSocialAuth = (provider: string) => {
    toast({
      title: "Demo Mode", 
      description: `${provider} authentication will be available once Supabase is connected.`,
      duration: 3000
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gradient-card border-0 shadow-primary">
        <DialogHeader className="text-center">
          <DialogTitle className="heading-lg gradient-primary bg-clip-text text-transparent">
            {mode === 'login' ? 'Welcome Back!' : 'Join FriendlySpot'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Social Auth */}
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full h-12 transition-smooth hover:shadow-card"
              onClick={() => handleSocialAuth('Google')}
            >
              <Chrome className="w-5 h-5 mr-3" />
              Continue with Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-12 transition-smooth hover:shadow-card"
              onClick={() => handleSocialAuth('Facebook')}
            >
              <Facebook className="w-5 h-5 mr-3" />
              Continue with Facebook
            </Button>
          </div>

          <div className="relative">
            <Separator />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4 text-sm text-muted-foreground">
              or continue with
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email/Phone Toggle */}
            <div className="space-y-2">
              <Label>Email or Phone</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email or phone"
                  className="pl-10 h-12"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pr-10 h-12"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Confirm Password for Signup */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Confirm your password"
                  className="h-12"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full h-12 gradient-primary text-white shadow-primary transition-smooth hover:shadow-glow"
            >
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Mode Switch */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <Button 
                variant="link" 
                className="ml-1 p-0 h-auto text-primary gradient-primary bg-clip-text text-transparent font-semibold"
                onClick={() => onModeChange(mode === 'login' ? 'signup' : 'login')}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Button>
            </p>
          </div>

          {/* Terms for Signup */}
          {mode === 'signup' && (
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              By creating an account, you agree to our Terms of Service and Privacy Policy. 
              Your location data is kept private and secure.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;