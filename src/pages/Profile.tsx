import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Settings, Edit3, MapPin, Users, Camera, Bell, Shield, LogOut, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ---
// (We should define these in a central types file, e.g., @/types/index.ts)
interface ProfileData {
  user_id: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
}
interface LocationData {
  is_sharing_location: boolean;
}
interface ProfileStats {
  friends: number;
  events: number;
  messages: number;
}
interface CombinedProfile {
  profile: ProfileData | null;
  location: LocationData | null;
  stats: ProfileStats;
}

// --- Helper: Data Fetching Function ---
const fetchProfileData = async (userId: string): Promise<CombinedProfile> => {
  // 1. Define all queries
  const profileQuery = supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  const locationQuery = supabase
    .from('user_locations')
    .select('is_sharing_location')
    .eq('user_id', userId)
    .single();

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

  // 2. Run all queries in parallel
  const [
    { data: profileData, error: profileError },
    { data: locationData, error: locationError },
    { count: friendCount, error: friendError },
    { count: eventCount, error: eventError },
    { count: messageCount, error: messageError },
  ] = await Promise.all([profileQuery, locationQuery, friendQuery, eventQuery, messageQuery]);

  // 3. Handle errors (you can get more granular)
  if (profileError && profileError.code !== 'PGRST116') throw profileError; // Ignore "no rows" error
  if (locationError && locationError.code !== 'PGRST116') throw locationError;
  if (friendError) throw friendError;
  if (eventError) throw eventError;
  if (messageError) throw messageError;

  // 4. Return combined data
  return {
    profile: profileData,
    location: locationData,
    stats: {
      friends: friendCount || 0,
      events: eventCount || 0,
      messages: messageCount || 0,
    },
  };
};


const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  // --- Data Fetching with useQuery ---
  const { data, isLoading: loading } = useQuery<CombinedProfile, Error>({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    onSuccess: (data) => {
      // Set local editing state *after* data is fetched
      if (data?.profile) {
        setDisplayName(data.profile.display_name || '');
        setBio(data.profile.bio || '');
      }
    },
  });

  const { profile, location, stats } = data || { profile: null, location: null, stats: { friends: 0, events: 0, messages: 0 } };
  const [locationSharing, setLocationSharing] = useState(!!location?.is_sharing_location);
  const [notifications, setNotifications] = useState(true); // Placeholder

  // Update local state if location data loads
  useEffect(() => {
    setLocationSharing(!!location?.is_sharing_location);
  }, [location]);

  // --- Mutations ---

  // 1. Mutation for saving profile text
  const updateProfileMutation = useMutation({
    mutationFn: async ({ displayName, bio }: { displayName: string, bio: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          bio: bio,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      setIsEditing(false);
      // Refetch profile data
      queryClient.invalidateQueries({ queryKey: ['profile', user!.id] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update profile: ' + error.message);
    }
  });

  // 2. Mutation for toggling location
  const toggleLocationMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      const { error } = await supabase
        .from('user_locations')
        .update({ is_sharing_location: checked })
        .eq('user_id', user!.id);
      if (error) throw error;
      return checked;
    },
    onSuccess: (checked) => {
      toast.success(checked ? 'Location sharing enabled' : 'Location sharing disabled');
      // Optimistically update the query data
      queryClient.setQueryData(['profile', user!.id], (oldData: CombinedProfile | undefined) => {
        if (!oldData) return;
        return {
          ...oldData,
          location: { ...oldData.location, is_sharing_location: checked }
        };
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to update setting: ' + error.message);
      setLocationSharing(!locationSharing); // Revert optimistic update
    }
  });
  
  // 3. Mutation for uploading avatar
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user!.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars') // Bucket name
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user!.id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Avatar updated!');
      // Refetch profile to get new URL
      queryClient.invalidateQueries({ queryKey: ['profile', user!.id] });
    },
    onError: (error: Error) => {
      toast.error('Failed to upload avatar: ' + error.message);
    }
  });

  // --- Handlers ---
  const handleSave = () => {
    updateProfileMutation.mutate({ displayName, bio });
  };

  const handleLocationToggle = (checked: boolean) => {
    setLocationSharing(checked); // Optimistic update
    toggleLocationMutation.mutate(checked);
  };
  
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadAvatarMutation.mutate(file);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  const statsList = [
    { label: 'Friends', value: stats.friends, icon: Users },
    { label: 'Events Joined', value: stats.events, icon: MapPin },
    { label: 'Messages Sent', value: stats.messages, icon: Bell }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-lg text-white">Profile</h1>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="w-5 h-5 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>

          {/* Profile Info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-white/20 text-white text-2xl">
                  {displayName.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button 
                  size="sm" 
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full gradient-secondary text-white p-0"
                  asChild // Make the button act as a label
                >
                  <label htmlFor="avatar-upload">
                    <Camera className="w-4 h-4" />
                    <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                </Button>
              )}
            </div>
            
            <div className="flex-1">
              {isEditing ? (
                <Input 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/70 mb-2"
                  placeholder="Your name"
                />
              ) : (
                <h2 className="heading-lg text-white mb-1">{profile?.display_name || 'Set your name'}</h2>
              )}
              <p className="text-white/70 text-sm">{user?.email}</p>
              <p className="text-white/70 text-sm">Member since {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-mobile py-6 space-y-6">
        {/* Bio Section */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="heading-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself..."
                className="min-h-[100px]"
              />
            ) : (
              <p className="text-muted-foreground">{profile?.bio || 'No bio yet. Add one by editing your profile!'}</p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {statsList.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="gradient-card shadow-card border-0">
                <CardContent className="p-4 text-center">
                  <div className="gradient-primary text-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Settings */}
        <Card className="gradient-card shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="heading-lg">Privacy & Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Location Sharing</h4>
                <p className="text-sm text-muted-foreground">Let friends see your general location</p>
              </div>
              <Switch 
                checked={locationSharing}
                onCheckedChange={handleLocationToggle}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Push Notifications</h4>
                <p className="text-sm text-muted-foreground">Get notified about messages and events</p>
              </div>
              <Switch 
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4 space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start gradient-primary text-white border-0 hover:opacity-90"
              onClick={() => navigate('/premium')}
            >
              <Crown className="w-4 h-4 mr-3" />
              Upgrade to Premium
            </Button>
            {/* ... other buttons ... */}
            <Button 
              variant="outline" 
              className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {isEditing && (
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditing(false);
                setDisplayName(profile?.display_name || '');
                setBio(profile?.bio || '');
              }}
            >
              Cancel
            </Button>
            <Button 
              className="gradient-primary text-white"
              onClick={handleSave}
              disabled={updateProfileMutation.isLoading}
            >
              {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
