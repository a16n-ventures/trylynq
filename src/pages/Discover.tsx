import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, X, Loader2, AlertCircle, Plus, Play, Image as ImageIcon } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// --- Type Definitions ---
interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  user_id: string;
}

interface Community {
  id: string;
  name: string;
  member_count: number | null;
  description: string | null;
  avatar_url: string | null;
}

interface Event {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
}

type ProfileWithStoryInner = Profile & {
  stories: { id: string; created_at: string }[];
};

// --- Components ---

const DataFeedback: React.FC<{
  isLoading: boolean;
  error: string | null;
  loadingText?: string;
  errorText?: string;
  children: React.ReactNode;
}> = ({ isLoading, error, loadingText = "Loading...", errorText = "Could not load data.", children }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{loadingText}</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 text-destructive py-4">
        <AlertCircle className="w-4 h-4" />
        <span>{errorText}</span>
      </div>
    );
  }
  return <>{children}</>;
};

interface StoryViewerProps {
  user: Profile;
  onClose: () => void;
}

function StoryViewer({ user, onClose }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserStories() {
      setLoading(true);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select('id, media_url, media_type, created_at, user_id')
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: true });

      if (error) setError(error.message);
      else setStories(data || []);
      setLoading(false);
    }
    fetchUserStories();
  }, [user.id]);

  const goToNextStory = () => {
    if (currentStoryIndex < stories.length - 1) setCurrentStoryIndex((prev) => prev + 1);
    else onClose();
  };

  const goToPrevStory = () => setCurrentStoryIndex((prev) => Math.max(prev - 1, 0));

  const currentStory = stories[currentStoryIndex];

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-0 sm:p-4">
      <button onClick={onClose} className="absolute top-6 right-6 text-white/80 hover:text-white z-50">
        <X className="w-8 h-8" />
      </button>

      {loading && <Loader2 className="w-10 h-10 text-white animate-spin" />}
      {error && <div className="text-white">{error}</div>}
      {!loading && !error && !currentStory && <div className="text-white">No active stories.</div>}

      {!loading && !error && currentStory && (
        <div className="relative w-full h-full sm:h-[90vh] sm:max-w-md bg-black sm:rounded-lg overflow-hidden flex flex-col">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full z-20 flex gap-1 p-2">
            {stories.map((_, idx) => (
              <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div className={`h-full bg-white transition-all duration-300 ${idx <= currentStoryIndex ? 'w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-0 w-full p-4 z-20 bg-gradient-to-b from-black/60 to-transparent flex items-center gap-3">
            <img src={user.avatar_url ?? '/default-avatar.png'} className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
            <span className="text-white font-semibold text-sm">{user.username}</span>
            <span className="text-white/60 text-xs">
              {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center bg-black relative">
            {currentStory.media_type === 'image' ? (
              <img src={currentStory.media_url} className="w-full h-full object-contain" />
            ) : (
              <video src={currentStory.media_url} className="w-full h-full object-contain" autoPlay playsInline onEnded={goToNextStory} />
            )}
          </div>

          {/* Navigation Taps */}
          <div className="absolute inset-0 z-10 flex">
            <div className="w-1/3 h-full" onClick={goToPrevStory} />
            <div className="w-2/3 h-full" onClick={goToNextStory} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Discover() {
  const { user } = useAuth();
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState<Profile | null>(null);

  const [storyLoading, setStoryLoading] = useState(true);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(true);
  
  // Story Upload
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current user has an active story
  const hasActiveStory = storyUsers.some(u => u.id === user?.id);

  const fetchStoryUsers = async () => {
    setStoryLoading(true);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, stories!inner(id, created_at)')
      .filter('stories.created_at', 'gte', oneDayAgo)
      .returns<ProfileWithStoryInner[]>();
    
    // Deduplicate users
    if (data) {
      const uniqueUsers = Array.from(new Map(data.map(item => [item.id, item])).values());
      setStoryUsers(uniqueUsers);
    }
    setStoryLoading(false);
  };

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('id, username, avatar_url').eq('id', user.id).single()
        .then(({ data }) => setCurrentUserProfile(data));
    }

    fetchStoryUsers();

    // Fetch Communities
    setCommunityLoading(true);
    supabase.from('communities').select('id, name, member_count, description, avatar_url')
      .order('member_count', { ascending: false }).limit(10)
      .then(({ data }) => {
        setCommunities(data || []);
        setCommunityLoading(false);
      });

    // Fetch Events
    setEventLoading(true);
    const today = new Date().toISOString();
    supabase.from('events').select('id, name, event_date, location')
      .gte('event_date', today).order('event_date', { ascending: true }).limit(10)
      .then(({ data }) => {
        setEvents(data || []);
        setEventLoading(false);
      });
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) return alert("File too large (max 50MB)");

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage.from('stories').upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(filePath);
      
      await supabase.from('stories').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: file.type.startsWith('video') ? 'video' : 'image'
      });

      await fetchStoryUsers();
    } catch (err) {
      console.error(err);
      alert("Failed to upload story");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMyStoryClick = () => {
    if (hasActiveStory && currentUserProfile) {
      setSelectedStoryUser(currentUserProfile);
    } else {
      fileInputRef.current?.click();
    }
  };

  const formatEventDate = (date: string | null) => {
    if (!date) return { month: 'TBD', day: '?', full: 'TBD' };
    const d = new Date(date);
    return {
      month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
      day: d.getDate(),
      full: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    };
  };

  return (
    <div className="container-mobile py-4 space-y-6 pb-20">
      {/* Stories Tray */}
      <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
        <DataFeedback isLoading={storyLoading} error={null}>
          <div className="flex gap-4 px-4 items-start">
            {/* My Story */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0 relative group">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
              
              <div className="relative cursor-pointer" onClick={handleMyStoryClick}>
                <div className={`w-16 h-16 rounded-full p-[3px] ${hasActiveStory ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600' : 'border-2 border-dashed border-muted-foreground/30'}`}>
                  <img 
                    src={currentUserProfile?.avatar_url ?? '/default-avatar.png'} 
                    className="w-full h-full rounded-full object-cover bg-background"
                  />
                </div>
                {/* Add Button Badge */}
                <div 
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background hover:scale-110 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </div>
              </div>
              <span className="text-xs font-medium">Your Story</span>
            </div>

            {/* Friends Stories */}
            {storyUsers.map((u) => {
              if (u.id === user?.id) return null;
              return (
                <div key={u.id} className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => setSelectedStoryUser(u)}>
                  <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 hover:scale-105 transition-transform">
                    <img src={u.avatar_url ?? '/default-avatar.png'} className="w-full h-full rounded-full object-cover border-2 border-background" />
                  </div>
                  <span className="text-xs font-medium max-w-[70px] truncate">{u.username}</span>
                </div>
              );
            })}
          </div>
        </DataFeedback>
      </div>

      <div className="px-4">
        <h1 className="text-2xl font-bold mb-4">Discover</h1>
        <Tabs defaultValue="communities" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="communities">Communities</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="communities" className="space-y-3 mt-4">
            <DataFeedback isLoading={communityLoading} error={null} loadingText="Loading communities...">
              {communities.length === 0 && (
                <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground">No active communities found.</div>
              )}
              {communities.map((c) => (
                <Card key={c.id} className="hover:bg-accent/5 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <img src={c.avatar_url ?? '/default-avatar.png'} className="w-12 h-12 rounded-xl object-cover bg-secondary" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.member_count?.toLocaleString()} members</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{c.description}</p>
                    </div>
                    <Button size="sm" variant="secondary">Join</Button>
                  </CardContent>
                </Card>
              ))}
            </DataFeedback>
          </TabsContent>

          <TabsContent value="events" className="space-y-3 mt-4">
            <DataFeedback isLoading={eventLoading} error={null} loadingText="Loading events...">
              {events.length === 0 && (
                <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground">No upcoming events.</div>
              )}
              {events.map((e) => {
                const date = formatEventDate(e.event_date);
                return (
                  <Card key={e.id} className="hover:bg-accent/5 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-14 h-16 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary flex-shrink-0">
                        <span className="text-[10px] font-bold uppercase">{date.month}</span>
                        <span className="text-xl font-bold">{date.day}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{e.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                           <Calendar className="w-3 h-3" /> <span>{date.full}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                           <MapPin className="w-3 h-3" /> <span>{e.location}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">View</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </DataFeedback>
          </TabsContent>
        </Tabs>
      </div>

      {selectedStoryUser && <StoryViewer user={selectedStoryUser} onClose={() => setSelectedStoryUser(null)} />}
    </div>
  );
}
      
