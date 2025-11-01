import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Mail, Eye, EyeOff, Chrome, Facebook } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
}

const AuthModal = ({ open, onOpenChange, mode, onModeChange }: AuthModalProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const { toast } = useToast();
  const { signUp, signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (mode === 'signup' && formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = mode === 'signup' 
        ? await signUp(formData.email, formData.password)
        : await signIn(formData.email, formData.password);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        if (mode === 'signup') {
          toast({
            title: "Success!",
            description: "Account created! Please check your email to verify.",
          });
        } else {
          toast({
            title: "Success!",
            description: "Signed in successfully",
          });
          onOpenChange(false);
          navigate('/app');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: string) => {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
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
              disabled={loading}
            >
              <Chrome className="w-5 h-5 mr-3" />
              Continue with Google
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
              disabled={loading}
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
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