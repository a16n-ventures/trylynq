import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Edit3, MapPin, Users, Camera, Bell, LogOut, Crown, 
  Trash2, Loader2, Gift, Copy, Radar, BarChart3, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- Types ---
interface ProfileData {
  user_id: string; display_name: string; bio: string; avatar_url: string; created_at: string;
  profile_views_30d?: number; // New Stat
  preferences?: { notifications: boolean; discovery_radius?: number; };
}
interface LocationData { is_sharing_location: boolean; }
interface ProfileStats { friends: number; events: number; messages: number; event_views_30d?: number; } // New Stat
interface CombinedProfile { profile: ProfileData | null; location: LocationData | null; stats: ProfileStats; }

const fetchProfileData = async (userId: string): Promise<CombinedProfile> => {
  const profileQuery = supabase.from('profiles').select('*').eq('user_id', userId).single();
  const locationQuery = supabase.from('user_locations').select('is_sharing_location').eq('user_id', userId).single();
  const friendQuery = supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const eventQuery = supabase.from('event_attendees').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  const messageQuery = supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', userId);
  
  // Fetch Event Views (Aggregate)
  const eventViewsQuery = supabase.from('events').select('event_views_30d.sum()').eq('creator_id', userId);

  const [
    { data: profileData }, { data: locationData }, { count: friendCount }, { count: eventCount }, { count: messageCount }
  ] = await Promise.all([profileQuery, locationQuery, friendQuery, eventQuery, messageQuery]);
  
  return {
    profile: profileData, location: locationData,
    stats: {
      friends: friendCount || 0, events: eventCount || 0, messages: messageCount || 0,
      event_views_30d: (profileData as any)?.event_views_30d || 0 // Mock/Real data hook
    },
  };
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [discoveryRadius, setDiscoveryRadius] = useState([5000]); 

  const { data, isLoading: loading } = useQuery<CombinedProfile, Error>({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user,
  });

  const { profile, location, stats } = data || { profile: null, location: null, stats: { friends: 0, events: 0, messages: 0, event_views_30d: 0 } };

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setDiscoveryRadius([profile.preferences?.discovery_radius || 5000]);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const currentPrefs = profile?.preferences || {};
      const newPrefs = { ...currentPrefs, ...updates.preferences };
      await supabase.from('profiles').update({ ...updates, preferences: newPrefs, updated_at: new Date().toISOString() }).eq('user_id', user!.id);
    },
    onSuccess: () => { toast.success('Saved'); setIsEditing(false); queryClient.invalidateQueries({ queryKey: ['profile', user!.id] }); }
  });

  const toggleLocationMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      await supabase.from('user_locations').upsert({ user_id: user!.id, is_sharing_location: checked });
      return checked;
    },
    onSuccess: (checked) => {
      toast.success(checked ? 'Location visible' : 'Location hidden');
      queryClient.setQueryData(['profile', user!.id], (old: any) => ({ ...old, location: { ...old.location, is_sharing_location: checked } }));
    }
  });

  const handleReferral = () => {
    // Generates: https://lynq.app/signup?ref=LYNQ-USERID
    const link = `${window.location.origin}/signup?ref=LYNQ-${user?.id.slice(0, 6).toUpperCase()}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied to clipboard!");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary text-white pb-8 pt-6 rounded-b-[2.5rem] shadow-lg">
        <div className="container-mobile">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-lg text-white">Profile</h1>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setIsEditing(!isEditing)}>
              <Edit3 className="w-4 h-4 mr-2" /> {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white/20 shadow-xl">
                <AvatarImage src={avatarPreview || profile?.avatar_url || ''} className="object-cover" />
                <AvatarFallback className="bg-white/20 text-white text-3xl">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              {isEditing ? <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-white/10 border-white/20 text-white" /> : <h2 className="text-2xl font-bold truncate">{profile?.display_name || 'User'}</h2>}
              <p className="text-white/80 text-sm truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2"><Crown className="w-3 h-3 text-yellow-300" /><span className="text-xs font-medium text-yellow-300">Free Member</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-mobile -mt-4 relative z-10 space-y-5">
        
        {/* 30-DAY INSIGHTS (New Feature) */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-muted/30 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-4 h-4" /> 30-Day Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 p-0">
             <div className="p-4 border-r flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{profile?.profile_views_30d || 0}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> Profile Views</span>
             </div>
             <div className="p-4 flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{stats.event_views_30d || 0}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Radar className="w-3 h-3" /> Event Reach</span>
             </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[{ l: 'Friends', v: stats.friends, i: Users }, { l: 'Events', v: stats.events, i: MapPin }, { l: 'Messages', v: stats.messages, i: Bell }].map((s, i) => (
            <Card key={i} className="gradient-card shadow-sm border-0">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center h-24">
                <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center mb-1"><s.i className="w-4 h-4" /></div>
                <span className="text-xl font-bold">{s.v}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral (Updated) */}
        <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
             <div>
               <div className="flex items-center gap-2 mb-1"><Gift className="w-4 h-4" /><h3 className="font-bold">Refer & Earn</h3></div>
               <p className="text-xs text-white/80">Share your unique link to earn perks.</p>
             </div>
             <Button size="sm" variant="secondary" className="text-indigo-600" onClick={handleReferral}>
               <Copy className="w-3 h-3 mr-2" /> Copy Link
             </Button>
          </CardContent>
        </Card>

        {/* Bio & Settings */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            {isEditing ? <Textarea value={bio} onChange={(e) => setBio(e.target.value)} /> : <p className="text-sm text-muted-foreground">{profile?.bio || "No bio yet."}</p>}
            {isEditing && <Button className="w-full mt-4 gradient-primary" onClick={() => updateProfileMutation.mutate({ displayName, bio })}>Save</Button>}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground ml-1">PREFERENCES</h3>
          <Card className="border-0 shadow-sm overflow-hidden divide-y divide-border/50">
             {/* Discovery Slider */}
             <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm font-medium"><span>Discovery Radius</span><span className="text-primary">{discoveryRadius[0]}m</span></div>
                <Slider value={discoveryRadius} onValueChange={setDiscoveryRadius} onValueCommit={() => updateProfileMutation.mutate({ preferences: { discovery_radius: discoveryRadius[0] } })} max={20000} step={100} />
             </div>
             <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium">Location Sharing</span>
                <Switch checked={!!location?.is_sharing_location} onCheckedChange={(c) => toggleLocationMutation.mutate(c)} />
             </div>
          </Card>
        </div>

        <div className="pb-8">
           <Button variant="destructive" className="w-full" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2"/> Sign Out</Button>
        </div>
      </div>
    </div>
  );
};
export default Profile;
