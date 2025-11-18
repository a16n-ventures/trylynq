import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, X, Loader2, AlertCircle } from "lucide-react";
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// --- Type Definitions ---
// maintained manual definitions as requested for stability

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

// Inner join type for efficiently fetching users who have stories
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

// --- Story Viewer Component ---
interface StoryViewerProps {
  user: Profile;
  onClose: () => void;
}

function StoryViewer({ user, onClose }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active stories for the selected user
  useEffect(() => {
    async function fetchUserStories() {
      setLoading(true);
      setError(null);
      // 24-hour window for stories
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // DIRECT QUERY: Fetch stories directly from the table
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
      onClose(); // Close viewer if it's the last story
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
          
          {/* Story Progress Bar */}
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

          {/* User Header */}
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

          {/* Story Media */}
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
                // Muted needed for autoplay on many browsers without interaction, 
                // though stories usually desire sound. 
                // We keep it unmuted but ensure playsInline is present.
                onEnded={goToNextStory}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* Tap Navigation Zones */}
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
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState<Profile | null>(null);

  const [storyLoading, setStoryLoading] = useState(true);
  const [storyError, setStoryError] = useState<string | null>(null);
  
  const [communityLoading, setCommunityLoading] = useState(true);
  const [communityError, setCommunityError] = useState<string | null>(null);

  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch users with active stories (last 24h)
    async function fetchStoryUsers() {
      setStoryLoading(true);
      setStoryError(null);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // DIRECT QUERY: Inner join on stories to only get users who posted recently
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          username, 
          avatar_url,
          stories!inner (id, created_at)
        `)
        .filter('stories.created_at', 'gte', oneDayAgo)
        .limit(15) // Limit tray size for performance
        .returns<ProfileWithStoryInner[]>();

      if (error) {
        console.error('Error fetching story users:', error);
        setStoryError(error.message);
      } else if (data) {
        setStoryUsers(data); 
      }
      setStoryLoading(false);
    }

    // 2. Fetch Communities (Popular/Featured)
    async function fetchCommunities() {
      setCommunityLoading(true);
      setCommunityError(null);
      
      // DIRECT QUERY: Order by member count to show popular communities first
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

    // 3. Fetch Upcoming Events
    async function fetchEvents() {
      setEventLoading(true);
      setEventError(null);
      
      // DIRECT QUERY: Filter for FUTURE events only
      const today = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, location')
        .gte('event_date', today) // Don't show past events in production
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

    fetchStoryUsers();
    fetchCommunities();
    fetchEvents();
  }, []);

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
      <div className="container-mobile py-4 space-y-6 pb-20"> {/* Added pb-20 for bottom nav clearance */}
        
        {/* --- Story Tray --- */}
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <DataFeedback
            isLoading={storyLoading}
            error={storyError}
            loadingText="Loading stories..."
            errorText="Could not load stories."
          >
            <div className="flex gap-4 px-4"> {/* px-4 for visual breathing room */}
              {storyUsers.map((user) => (
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
              ))}
            </div>
            {!storyLoading && !storyError && storyUsers.length === 0 && (
              <div className="text-sm text-muted-foreground px-4 italic">
                No stories from your circle yet.
              </div>
            )}
          </DataFeedback>
        </div>

        {/* --- Main Content Tabs --- */}
        <div className="px-4"> {/* Constrain width on mobile */}
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
                                onError={(e) => { e.currentTarget.src = '/default-avatar.png' }} // Fallback
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
                )}
                {events.map((event) => {
                    const { month, day, fullDate } = formatEventDate(event.event_date);
                    return (
                    <Card key={event.id} className="hover:bg-accent/5 transition-colors">
                        <CardContent className="p-4">
                        <div className="flex gap-4 items-center">
                            <div className="w-14 h-16 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary flex-shrink-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider">{month}</div>
                            <div className="text-xl font-bold leading-none">{day}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{event.name}</h3>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="truncate">{fullDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{event.location ?? 'Location TBD'}</span>
                            </div>
                            </div>
                            <Button size="sm" variant="outline">View</Button>
                        </div>
                        </CardContent>
                    </Card>
                    );
                })}
                </DataFeedback>
            </TabsContent>
            </Tabs>
        </div>
      </div>

      {/* --- Story Viewer Modal --- */}
      {selectedStoryUser && (
        <StoryViewer user={selectedStoryUser} onClose={closeStory} />
      )}
    </>
  );
  }
        
