import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, X, Loader2, AlertCircle, Plus, Upload } from "lucide-react"; // Added Plus, Upload
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast"; // Assuming you have a toast hook, if not I'll use standard alert/error state

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

// --- Helper: Loading & Error Component ---
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

// --- Story Viewer Component (Unchanged) ---
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
      setError(null);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('stories')
        .select('id, media_url, media_type, created_at, user_id')
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: true })
        .returns<Story[]>();

      if (error) {
        console.error('Error fetching stories:', error);
        setError(error.message);
      } else if (data) {
        setStories(data);
      }
      setLoading(false);
    }
    fetchUserStories();
  }, [user.id]);

  const goToNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
    } else {
      onClose(); 
    }
  };

  const goToPrevStory = () => {
    setCurrentStoryIndex((prev) => Math.max(prev - 1, 0));
  };

  const currentStory = stories[currentStoryIndex];

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-0 sm:p-4">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white/80 hover:text-white z-50 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      {loading && <Loader2 className="w-10 h-10 text-white animate-spin" />}
      
      {error && (
         <div className="text-white text-center p-4">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p className="mb-4">{error}</p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      )}

      {!loading && !error && stories.length === 0 && (
        <div className="text-white text-center">
          <p className="mb-4">No active stories for this user.</p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      )}

      {!loading && !error && currentStory && (
        <div className="relative w-full h-full sm:h-[90vh] sm:max-w-md bg-black sm:rounded-lg overflow-hidden flex flex-col">
          
          <div className="absolute top-0 left-0 w-full z-20 flex gap-1 p-2">
            {stories.map((_, idx) => (
              <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                 <div 
                   className={`h-full bg-white transition-all duration-300 ${
                     idx < currentStoryIndex ? 'w-full' : idx === currentStoryIndex ? 'w-full' : 'w-0'
                   }`}
                 />
              </div>
            ))}
          </div>

          <div className="absolute top-4 left-0 w-full p-4 z-20 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-3">
              <img 
                src={user.avatar_url ?? '/default-avatar.png'} 
                alt={user.username ?? 'User'} 
                className="w-10 h-10 rounded-full border-2 border-white/20 object-cover"
                onError={(e) => { e.currentTarget.src = '/default-avatar.png' }}
              />
              <span className="text-white font-semibold text-sm drop-shadow-md">{user.username}</span>
              <span className="text-white/60 text-xs">
                 {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative bg-black">
            {currentStory.media_type === 'image' ? (
              <img
                src={currentStory.media_url}
                alt="Story"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                src={currentStory.media_url}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                onEnded={goToNextStory}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <div className="absolute inset-0 z-10 flex">
            <div className="w-1/3 h-full" onClick={goToPrevStory} />
            <div className="w-2/3 h-full" onClick={goToNextStory} />
          </div>
        </div>
      )}
    </div>
  );
}


// --- Main Discover Component ---

export default function Discover() {
  // State for data
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState<Profile | null>(null);

  // Loading States
  const [storyLoading, setStoryLoading] = useState(true);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // --- NEW: State for Uploading Story ---
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // --------------------------------------

  // Function to fetch story users (extracted so we can call it after upload)
  const fetchStoryUsers = async () => {
    setStoryLoading(true);
    setStoryError(null);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, 
        username, 
        avatar_url,
        stories!inner (id, created_at)
      `)
      .filter('stories.created_at', 'gte', oneDayAgo)
      .limit(15)
      .returns<ProfileWithStoryInner[]>();

    if (error) {
      console.error('Error fetching story users:', error);
      setStoryError(error.message);
    } else if (data) {
      setStoryUsers(data); 
    }
    setStoryLoading(false);
  };

  useEffect(() => {
    // 0. Get Current User (for the "Add Story" button)
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', user.id)
          .single();
        if (profile) setCurrentUser(profile);
      }
    }
    
    // 1. Fetch initial data
    getCurrentUser();
    fetchStoryUsers();

    // 2. Fetch Communities
    async function fetchCommunities() {
      setCommunityLoading(true);
      setCommunityError(null);
      const { data, error } = await supabase
        .from('communities')
        .select('id, name, member_count, description, avatar_url')
        .order('member_count', { ascending: false }) 
        .limit(10)
        .returns<Community[]>();

      if (error) {
        console.error('Error fetching communities:', error);
        setCommunityError(error.message);
      } else if (data) {
        setCommunities(data);
      }
      setCommunityLoading(false);
    }

    // 3. Fetch Events
    async function fetchEvents() {
      setEventLoading(true);
      setEventError(null);
      const today = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, location')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(10)
        .returns<Event[]>();

      if (error) {
        console.error('Error fetching events:', error);
        setEventError(error.message);
      } else if (data) {
        setEvents(data);
      }
      setEventLoading(false);
    }

    fetchCommunities();
    fetchEvents();
  }, []);


  // --- NEW: Handle Story Upload ---
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    // Basic validation
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      alert("File too large. Please upload under 50MB.");
      return;
    }

    setIsUploadingStory(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload to Storage Bucket 'stories'
      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(filePath);

      // 3. Insert into DB
      const mediaType = file.type.startsWith('video') ? 'video' : 'image';
      
      const { error: dbError } = await supabase
        .from('stories')
        .insert({
          user_id: currentUser.id,
          media_url: publicUrl,
          media_type: mediaType,
        });

      if (dbError) throw dbError;

      // 4. Success! Refresh stories
      alert("Story added successfully!");
      await fetchStoryUsers(); // Refresh the list so we see our new story/position

    } catch (error: any) {
      console.error("Error uploading story:", error);
      alert(error.message || "Failed to upload story");
    } finally {
      setIsUploadingStory(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openStory = (user: Profile) => setSelectedStoryUser(user);
  const closeStory = () => setSelectedStoryUser(null);

  const formatEventDate = (dateString: string | null) => {
    if (!dateString) return { month: 'TBD', day: '?', fullDate: 'Date not specified' };
    const date = new Date(dateString);
    const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const fullDate = date.toLocaleDateString('default', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return { month, day, fullDate };
  };

  return (
    <>
      <div className="container-mobile py-4 space-y-6 pb-20">
        
        {/* --- Story Tray --- */}
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <DataFeedback
            isLoading={storyLoading}
            error={storyError}
            loadingText="Loading stories..."
            errorText="Could not load stories."
          >
            <div className="flex gap-4 px-4 items-start">
              
              {/* --- NEW: Add Story Button --- */}
              {currentUser && (
                <div className="flex flex-col items-center gap-2 flex-shrink-0 group relative">
                   {/* Hidden File Input */}
                   <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    disabled={isUploadingStory}
                   />

                  <div 
                    className="w-16 h-16 rounded-full relative cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <img
                      src={currentUser.avatar_url ?? '/default-avatar.png'} 
                      alt="My Story"
                      className="w-full h-full rounded-full object-cover border-2 border-dashed border-muted-foreground/50 p-[2px]"
                    />
                    
                    {/* Overlay Icon */}
                    <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background">
                      {isUploadingStory ? (
                         <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                         <Plus className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium max-w-[70px] truncate text-center">
                    Your Story
                  </span>
                </div>
              )}

              {/* --- Existing Stories --- */}
              {storyUsers.map((user) => {
                // Don't show "Me" twice if I'm in the list. (Optional, but good UX)
                if (user.id === currentUser?.id) return null;

                return (
                  <div
                    key={user.id}
                    className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 group"
                    onClick={() => openStory(user)}
                  >
                    <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 group-hover:scale-105 transition-transform">
                      <div className="w-full h-full rounded-full bg-background p-[2px]">
                        <img
                          src={user.avatar_url ?? '/default-avatar.png'} 
                          alt={user.username ?? 'User'}
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => { e.currentTarget.src = '/default-avatar.png' }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium max-w-[70px] truncate text-center">
                      {user.username}
                    </span>
                  </div>
                );
              })}
            </div>
          </DataFeedback>
        </div>

        {/* --- Main Content Tabs (Unchanged) --- */}
        <div className="px-4">
            <h1 className="text-2xl font-bold mb-4">Discover</h1>

            <Tabs defaultValue="communities" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="communities">Communities</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            {/* --- Communities Tab --- */}
            <TabsContent value="communities" className="space-y-3 mt-4">
                <DataFeedback
                isLoading={communityLoading}
                error={communityError}
                loadingText="Finding communities..."
                errorText="Could not load communities."
                >
                {communities.length === 0 && (
                    <div className="text-center py-8 border border-dashed rounded-lg">
                        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No active communities found.</p>
                    </div>
                )}
                {communities.map((community) => (
                    <Card key={community.id} className="overflow-hidden hover:bg-accent/5 transition-colors">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {community.avatar_url ? (
                            <img 
                                src={community.avatar_url} 
                                alt={community.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.src = '/default-avatar.png' }}
                            />
                            ) : (
                            <Users className="w-6 h-6 text-primary" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{community.name}</h3>
                            <p className="text-xs text-muted-foreground mb-1">
                                {community.member_count ? community.member_count.toLocaleString() : 0} members
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                                {community.description ?? 'No description available.'}
                            </p>
                        </div>
                        <Button size="sm" variant="secondary">Join</Button>
                        </div>
                    </CardContent>
                    </Card>
                ))}
                </DataFeedback>
            </TabsContent>

            {/* --- Events Tab --- */}
            <TabsContent value="events" className="space-y-3 mt-4">
                <DataFeedback
                isLoading={eventLoading}
                error={eventError}
                loadingText="Finding events near you..."
                errorText="Could not load events."
                >
                {events.length === 0 && (
                    <div className="text-center py-8 border border-dashed rounded-lg">
                        <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No upcoming events scheduled.</p>
                    </div>
        
