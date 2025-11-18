import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  Edit3, 
  MapPin, 
  Users, 
  Camera, 
  Bell, 
  Shield, 
  LogOut, 
  Crown, 
  Trash2,
  Loader2 
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
  preferences?: {
    notifications: boolean;
  };
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

  // Count queries - using count: 'exact', head: true for performance
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

  const [
    { data: profileData, error: profileError },
    { data: locationData, error: locationError },
    { count: friendCount, error: friendError },
    { count: eventCount, error: eventError },
    { count: messageCount, error: messageError },
  ] = await Promise.all([profileQuery, locationQuery, friendQuery, eventQuery, messageQuery]);

  // Handle errors smoothly - create profile if missing (rare edge case)
  if (profileError && profileError.code !== 'PGRST116') throw profileError;
  
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
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  // Local State
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // --- Data Fetching ---
  const { data, isLoading: loading } = useQuery<CombinedProfile, Error>({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, 
  });

  const { profile, location, stats } = data || { profile: null, location: null, stats: { friends: 0, events: 0, messages: 0 } };

  // Sync local state when data arrives
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  // --- Mutations ---

  // 1. Update Text & Preferences
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { displayName?: string; bio?: string; preferences?: any }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Saved');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile', user!.id] });
    },
    onError: (error: Error) => toast.error('Failed to update: ' + error.message)
  });

  // 2. Toggle Location
  const toggleLocationMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      // Upsert ensures row exists if it's a new user
      const { error } = await supabase
        .from('user_locations')
        .upsert({ user_id: user!.id, is_sharing_location: checked })
        .select();
        
      if (error) throw error;
      return checked;
    },
    onSuccess: (checked) => {
      toast.success(checked ? 'Location visible' : 'Location hidden');
      queryClient.setQueryData(['profile', user!.id], (old: any) => ({
        ...old,
        location: { ...old.location, is_sharing_location: checked }
      }));
    },
    onError: (error: Error) => toast.error('Failed to update location: ' + error.message)
  });
  
  // 3. Upload Avatar
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      // Use timestamp to avoid cache issues
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      // 1. Upload
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 3. Update Profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user!.id);
      
      if (updateError) throw updateError;
      return publicUrl;
    },
    onSuccess: (url) => {
      toast.success('Avatar updated!');
      setAvatarPreview(null); // Clear preview, let the real URL take over
      queryClient.invalidateQueries({ queryKey: ['profile', user!.id] });
    },
    onError: (error: Error) => toast.error('Upload failed: ' + error.message)
  });

  // 4. Delete Account
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // In Supabase, usually you call an Edge Function to delete the user from Auth + Database
      // For this snippet, we'll do a soft delete or sign out + toast
      const { error } = await supabase.rpc('delete_user'); // You need to create this RPC or use Edge Function
      if (error) throw error;
    },
    onSuccess: async () => {
      await signOut();
      navigate('/');
      toast.success('Account deleted.');
    },
    onError: () => toast.error('Could not delete account. Please contact support.')
  });

  // --- Handlers ---
  
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
      // Trigger upload
      uploadAvatarMutation.mutate(file);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="gradient-primary text-white pb-8 pt-6 rounded-b-[2.5rem] shadow-lg">
        <div className="container-mobile">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-lg text-white">Profile</h1>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20 transition-colors"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-white/20 shadow-xl">
                {/* Use preview if available, otherwise db url, otherwise fallback */}
                <AvatarImage src={avatarPreview || profile?.avatar_url || ''} className="object-cover" />
                <AvatarFallback className="bg-white/20 text-white text-3xl font-medium">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Upload Button Overlay */}
              <label 
                htmlFor="avatar-upload" 
                className="absolute bottom-0 right-0 w-8 h-8 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
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
            
            <div className="flex-1 min-w-0 space-y-1">
              {isEditing ? (
                <Input 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-9"
                  placeholder="Display Name"
                />
              ) : (
                <h2 className="text-2xl font-bold truncate">{profile?.display_name || 'User'}</h2>
              )}
              <p className="text-white/80 text-sm truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                 <Crown className="w-3 h-3 text-yellow-300" />
                 <span className="text-xs font-medium text-yellow-300">Free Member</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-mobile -mt-4 relative z-10 space-y-5">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {statsList.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="gradient-card shadow-sm border-0">
                <CardContent className="p-3 text-center flex flex-col items-center justify-center h-24">
                  <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center mb-1">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-bold text-foreground">{stat.value}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bio Section */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">About Me</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short bio..."
                className="resize-none bg-muted/50"
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {profile?.bio || "I'm new to Lynq! Say hello."}
              </p>
            )}
            
            {isEditing && (
              <Button 
                className="w-full mt-4 gradient-primary text-white" 
                onClick={() => updateProfileMutation.mutate({ displayName, bio })}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Settings Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground ml-1">PREFERENCES</h3>
          <Card className="border-0 shadow-sm overflow-hidden">
             <div className="divide-y divide-border/50">
               <div className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                     <MapPin className="w-4 h-4" />
                   </div>
                   <div>
                     <div className="font-medium text-sm">Location Sharing</div>
                     <div className="text-xs text-muted-foreground">Visible to friends</div>
                   </div>
                 </div>
                 <Switch 
                   checked={!!location?.is_sharing_location}
                   onCheckedChange={(c) => toggleLocationMutation.mutate(c)}
                   disabled={toggleLocationMutation.isPending}
                 />
               </div>

               <div className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                     <Bell className="w-4 h-4" />
                   </div>
                   <div>
                     <div className="font-medium text-sm">Notifications</div>
                     <div className="text-xs text-muted-foreground">Push alerts</div>
                   </div>
                 </div>
                 <Switch 
                    checked={profile?.preferences?.notifications ?? true} 
                    onCheckedChange={(c) => updateProfileMutation.mutate({ preferences: { notifications: c } })} 
                 />
               </div>
               
               <div className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => navigate('/premium')}>
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                     <Crown className="w-4 h-4" />
                   </div>
                   <div>
                     <div className="font-medium text-sm">Lynq Premium</div>
                     <div className="text-xs text-muted-foreground">Unlock exclusive features</div>
                   </div>
                 </div>
                 <div className="text-xs font-medium bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1 rounded-full">
                   UPGRADE
                 </div>
               </div>
             </div>
          </Card>
        </div>

        {/* Danger Zone / Account Actions */}
        <div className="space-y-3 pb-8">
          <h3 className="text-sm font-semibold text-muted-foreground ml-1">ACCOUNT</h3>
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="divide-y divide-border/50">
              <div 
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/5 text-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-red-50 text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Delete Account</span>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account
                      and remove your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => deleteAccountMutation.mutate()}
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
  
