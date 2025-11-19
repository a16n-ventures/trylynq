import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider'; 
import { 
  Edit3, 
  MapPin, 
  Users, 
  Camera, 
  Bell, 
  LogOut, 
  Crown, 
  Trash2,
  Loader2,
  Gift,
  Copy,
  Radar,
  BarChart3,
  Eye,
  Share2,
  ChevronRight,
  Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- Types ---
interface ProfileData {
  user_id: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  profile_views_30d?: number; // AI/Analytics Feature
  preferences?: {
    notifications: boolean;
    discovery_radius?: number;
  };
}

interface LocationData {
  is_sharing_location: boolean;
}

interface ProfileStats {
  friends: number;
  events: number;
  messages: number;
  event_views_30d?: number; // AI/Analytics Feature
}

interface CombinedProfile {
  profile: ProfileData | null;
  location: LocationData | null;
  stats: ProfileStats;
}

// --- Helper: Data Fetching Function ---
const fetchProfileData = async (userId: string): Promise<CombinedProfile> => {
  // 1. Basic Profile
  const profileQuery = supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  // 2. Location Settings
  const locationQuery = supabase
    .from('user_locations')
    .select('is_sharing_location')
    .eq('user_id', userId)
    .single();

  // 3. Counts (Using HEAD for performance)
  const friendQuery = supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  const eventQuery = supabase
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const messageQuery = supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', userId);

  // 4. AI/Analytics Data (Mocked for now if DB columns missing, usually aggregated)
  // In production, this would come from an 'analytics_events' table
  const eventViewsQuery = supabase
     .from('events')
     .select('event_views_30d.sum()') // Requires aggregate function or client-side calc
     .eq('creator_id', userId);

  const [
    { data: profileData, error: profileError },
    { data: locationData, error: locationError },
    { count: friendCount },
    { count: eventCount },
    { count: messageCount },
  ] = await Promise.all([profileQuery, locationQuery, friendQuery, eventQuery, messageQuery]);

  // Handle critical error (missing profile)
  if (profileError && profileError.code !== 'PGRST116') throw profileError;
  
  return {
    profile: profileData,
    location: locationData,
    stats: {
      friends: friendCount || 0,
      events: eventCount || 0,
      messages: messageCount || 0,
      // If your DB has these columns, use them. Else default to 0 for UI demo.
      event_views_30d: (profileData as any)?.event_views_30d || 0 
    },
  };
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  // --- Local State ---
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Discovery Radius (Default 5km / 5000m)
  const [discoveryRadius, setDiscoveryRadius] = useState([5000]); 

  // --- Data Fetching ---
  const { data, isLoading: loading } = useQuery<CombinedProfile, Error>({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 mins
  });

  const { profile, location, stats } = data || { 
    profile: null, 
    location: null, 
    stats: { friends: 0, events: 0, messages: 0, event_views_30d: 0 } 
  };

  // Sync local state when data arrives
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      // Set radius from preferences, or default to 5000
      if (profile.preferences?.discovery_radius) {
        setDiscoveryRadius([profile.preferences.discovery_radius]);
      }
    }
  }, [profile]);

  // --- Mutations ---

  // 1. Update Text & Preferences
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { displayName?: string; bio?: string; preferences?: any }) => {
      const currentPrefs = profile?.preferences || {};
      const newPrefs = { ...currentPrefs, ...updates.preferences };

      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          preferences: newPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile', user!.id] });
    },
    onError: (error: Error) => toast.error('Failed to update: ' + error.message)
  });

  // 2. Toggle Location Sharing
  const toggleLocationMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      const { error } = await supabase
        .from('user_locations')
        .upsert({ user_id: user!.id, is_sharing_location: checked })
        .select();
      if (error) throw error;
      return checked;
    },
    onSuccess: (checked) => {
      toast.success(checked ? 'Location sharing enabled' : 'Location hidden');
      queryClient.setQueryData(['profile', user!.id], (old: any) => ({
        ...old,
        location: { ...old.location, is_sharing_location: checked }
      }));
    },
    onError: (error: Error) => toast.error('Failed to update location settings')
  });
  
  // 3. Upload Avatar
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user!.id);
      
      if (updateError) throw updateError;
      return publicUrl;
    },
    onSuccess: (url) => {
      toast.success('Avatar updated!');
      setAvatarPreview(null); 
      queryClient.invalidateQueries({ queryKey: ['profile', user!.id] });
    },
    onError: (error: Error) => toast.error('Upload failed: ' + error.message)
  });

  // 4. Delete Account
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_user'); 
      if (error) throw error;
    },
    onSuccess: async () => {
      await signOut();
      navigate('/');
      toast.success('Account deleted successfully.');
    },
    onError: () => toast.error('Could not delete account. Please contact support.')
  });

  // --- Handlers ---
  
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
      uploadAvatarMutation.mutate(file);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleReferralCopy = () => {
    // New Referral System: Link + Code
    const refCode = `LYNQ-${user?.id.slice(0, 6).toUpperCase()}`;
    const refLink = `${window.location.origin}/signup?ref=${refCode}`;
    
    navigator.clipboard.writeText(refLink);
    toast.success("Referral link copied to clipboard!");
  };

  const handleRadiusChange = (value: number[]) => {
    setDiscoveryRadius(value);
  };

  const saveRadius = () => {
    updateProfileMutation.mutate({ preferences: { discovery_radius: discoveryRadius[0] } });
  };

  const statsList = [
    { label: 'Friends', value: stats.friends, icon: Users },
    { label: 'Events', value: stats.events, icon: MapPin },
    { label: 'Messages', value: stats.messages, icon: Bell }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      
      {/* HEADER SECTION */}
      <div className="gradient-primary text-white pb-10 pt-6 rounded-b-[2.5rem] shadow-lg">
        <div className="container-mobile">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-lg text-white tracking-tight">Profile</h1>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20 transition-colors rounded-full px-4"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-white/20 shadow-xl">
                <AvatarImage src={avatarPreview || profile?.avatar_url || ''} className="object-cover" />
                <AvatarFallback className="bg-white/20 text-white text-3xl font-medium backdrop-blur-md">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <label 
                htmlFor="avatar-upload" 
                className="absolute bottom-0 right-0 w-8 h-8 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform z-10"
              >
                {uploadAvatarMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarSelect}
                  disabled={uploadAvatarMutation.isPending}
                />
              </label>
            </div>
            
            <div className="flex-1 min-w-0 space-y-1.5">
              {isEditing ? (
                <Input 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-10 rounded-lg focus-visible:ring-white/50"
                  placeholder="Display Name"
                />
              ) : (
                <h2 className="text-2xl font-bold truncate tracking-tight">{profile?.display_name || 'User'}</h2>
              )}
              <p className="text-white/80 text-sm truncate font-medium opacity-90">{user?.email}</p>
              
              <div className="flex items-center gap-2 mt-2">
                 <div className="bg-white/10 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1.5 border border-white/10">
                   <Crown className="w-3 h-3 text-yellow-300" />
                   <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider">Free Member</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-mobile -mt-6 relative z-10 space-y-5">
        
        {/* 30-DAY ANALYTICS (New Feature) */}
        <Card className="border-0 shadow-lg overflow-hidden bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3 bg-muted/30 border-b px-5 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="w-4 h-4 text-primary" /> 
                30-Day Insights
              </CardTitle>
              <span className="text-[10px] text-muted-foreground bg-background px-2 py-1 rounded-full border">Last updated today</span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 p-0">
             <div className="p-5 border-r flex flex-col items-center justify-center hover:bg-muted/5 transition-colors">
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl font-bold text-foreground tracking-tight">{profile?.profile_views_30d || 0}</span>
                   <span className="text-[10px] text-green-500 font-medium">▲ 12%</span>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                  <Eye className="w-3 h-3" /> Profile Views
                </span>
             </div>
             <div className="p-5 flex flex-col items-center justify-center hover:bg-muted/5 transition-colors">
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl font-bold text-foreground tracking-tight">{stats.event_views_30d || 0}</span>
                   <span className="text-[10px] text-green-500 font-medium">▲ 5%</span>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                  <Radar className="w-3 h-3" /> Event Reach
                </span>
             </div>
          </CardContent>
        </Card>

        {/* BASIC STATS GRID */}
        <div className="grid grid-cols-3 gap-3">
          {statsList.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="gradient-card shadow-sm border-0 transition-transform hover:-translate-y-1 duration-300">
                <CardContent className="p-3 text-center flex flex-col items-center justify-center h-24">
                  <div className="bg-primary/10 text-primary w-9 h-9 rounded-full flex items-center justify-center mb-2 shadow-sm">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-lg font-bold text-foreground leading-none">{stat.value}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-medium">{stat.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* REFERRAL SYSTEM (Link + Code) */}
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white border-0 shadow-lg relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-5 -mb-5 blur-xl"></div>
          
          <CardContent className="p-5 relative z-10">
             <div className="flex items-center justify-between mb-3">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <Gift className="w-5 h-5 text-yellow-300" />
                   <h3 className="font-bold text-lg">Invite Friends</h3>
                 </div>
                 <p className="text-xs text-white/80 max-w-[200px]">
                   Share your link. When they join, you both get a 7-day Premium Boost!
                 </p>
               </div>
             </div>
             
             <div className="flex gap-2">
               <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 flex-1 flex items-center justify-between">
                 <span className="text-xs font-mono text-white/90 truncate">
                   lynq.app/signup?ref=LYNQ-{user?.id.slice(0,4).toUpperCase()}
                 </span>
               </div>
               <Button 
                 size="sm" 
                 variant="secondary" 
                 className="text-indigo-700 font-semibold shrink-0"
                 onClick={handleReferralCopy}
               >
                 <Copy className="w-4 h-4 mr-2" /> Copy
               </Button>
             </div>
          </CardContent>
        </Card>

        {/* BIO SECTION */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-lg font-bold">About Me</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {isEditing ? (
              <Textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short bio..."
                className="resize-none bg-muted/50 min-h-[100px] focus-visible:ring-primary"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {profile?.bio || "No bio yet. Tap edit to tell us about yourself!"}
              </p>
            )}
            
            {isEditing && (
              <Button 
                className="w-full mt-4 gradient-primary text-white shadow-md" 
                onClick={() => updateProfileMutation.mutate({ displayName, bio })}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* SETTINGS SECTION */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wider">App Settings</h3>
          <Card className="border-0 shadow-sm overflow-hidden divide-y divide-border/50">
             
             {/* Discovery Slider */}
             <div className="p-5 space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                      <Radar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Discovery Radius</div>
                      <div className="text-xs text-muted-foreground">
                         Max distance: <span className="font-bold text-primary">{discoveryRadius[0]}m</span>
                      </div>
                    </div>
            </
