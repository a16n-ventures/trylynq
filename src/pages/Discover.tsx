import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin, X, Loader2, AlertCircle } from "lucide-react";
import React, { useState, useEffect } from "react";
// Assumed Supabase client import path
import { supabase } from "@/integrations/supabase/client"; 
// Removed dependency on auto-generated types to fix build errors

// --- Type Definitions (Self-Contained) ---
// BEST PRACTICE: Define types manually *if* auto-generated types are not available
// This ensures the component is self-contained and avoids build errors.

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video'; // Assuming these are your enum values
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

// Type for the specific story user query joining profiles and stories
type ProfileWithStoryInner = Profile & {
  stories: { id: string; created_at: string }[];
};


// --- Helper: Loading & Error Component ---
// To avoid repeating loader/error logic
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


// --- Story Viewer Component (Fixed) ---

interface StoryViewerProps {
  user: Profile; // Uses the manually defined Profile type
  onClose: () => void;
}

function StoryViewer({ user, onClose }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all active stories for this user
  useEffect(() => {
    async function fetchUserStories() {
      setLoading(true);
      setError(null);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('stories')
        .select('id, media_url, media_type, created_at, user_id') // Be specific
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: true })
        .returns<Story[]>(); // Type-checks against our manual Story interface

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
    setCurrentStoryIndex((prev) => Math.min(prev + 1, stories.length - 1));
  };

  const goToPrevStory = () => {
    setCurrentStoryIndex((prev) => Math.max(prev - 1, 0));
  };

  const currentStory = stories[currentStoryIndex];

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white z-50"
      >
        <X className="w-8 h-8" />
      </button>

      {loading && <Loader2 className="w-10 h-10 text-white animate-spin" />}
      
      {error && (
         <div className="text-white text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p>Could not load stories.</p>
          <Button onClick={onClose} variant="outline" className="mt-4">Close</Button>
        </div>
      )}

      {!loading && !error && stories.length === 0 && (
        <div className="text-white text-center">
          <p>No active stories for this user.</p>
          <Button onClick={onClose} variant="outline" className="mt-4">Close</Button>
        </div>
      )}

      {!loading && !error && currentStory && (
        <div className="relative w-full max-w-md h-[90vh] bg-black rounded-lg overflow-hidden">
          {/* Story Content */}
          <div className="absolute inset-0 flex items-center justify-center">
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
                onEnded={goToNextStory} // Auto-advance on video end
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* User Info */}
          <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center gap-2">
              {/* NOTE: Assumes you have this fallback image in your /public folder */}
              <img src={user.avatar_url ?? '/default-avatar.png'} alt={user.username ?? 'User'} className="w-10 h-10 rounded-full border-2 border-white object-cover" />
              <span className="text-white font-semibold">{user.username}</span>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="absolute inset-y-0 left-0 w-1/3" onClick={goToPrevStory} />
          <div className="absolute inset-y-0 right-0 w-1/3" onClick={goToNextStory} />
        </div>
      )}
    </div>
  );
}


// --- Main Discover Component (Fixed) ---

export default function Discover() {
  // State for data
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState<Profile | null>(null);

  // Separate loading and error states for each data source
  const [storyLoading, setStoryLoading] = useState(true);
  const [storyError, setStoryError] = useState<string | null>(null);
  
  const [communityLoading, setCommunityLoading] = useState(true);
  const [communityError, setCommunityError] = useState<string | null>(null);

  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch users who have active stories
    async function fetchStoryUsers() {
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
        .returns<ProfileWithStoryInner[]>(); // Type-checks against our manual type

      if (error) {
        console.error('Error fetching story users:', error);
        setStoryError(error.message);
      } else if (data) {
        // Data is ProfileWithStoryInner[], which is compatible with Profile[] state
        setStoryUsers(data); 
      }
      setStoryLoading(false);
    }

    // Fetch communities
    async function fetchCommunities() {
      setCommunityLoading(true);
      setCommunityError(null);
      const { data, error } = await supabase
        .from('communities')
        .select('id, name, member_count, description, avatar_url')
        .limit(10)
        .returns<Community[]>(); // Type-checks against our manual Community interface

      if (error) {
        console.error('Error fetching communities:', error);
        setCommunityError(error.message);
      } else if (data) {
        setCommunities(data);
      }
      setCommunityLoading(false);
    }

    // Fetch events
    async function fetchEvents() {
      setEventLoading(true);
      setEventError(null);
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, location')
        .order('event_date', { ascending: true })
        .limit(10)
        .returns<Event[]>(); // Type-checks against our manual Event interface

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

  const openStory = (user: Profile) => {
    setSelectedStoryUser(user);
  };

  const closeStory = () => {
    setSelectedStoryUser(null);
  };

  // Helper to format event date
  const formatEventDate = (dateString: string | null) => {
    if (!dateString) return { month: '???', day: '??', fullDate: 'Date not specified' };
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
      <div className="container-mobile py-4 space-y-4">
        {/* --- Story Tray Feature (with loading/error) --- */}
        <div className="w-full overflow-x-auto pb-2 -mt-2">
          <DataFeedback
            isLoading={storyLoading}
            error={storyError}
            loadingText="Loading stories..."
            errorText="Could not load stories."
          >
            <div className="flex gap-4 px-1">
              {storyUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0"
                  onClick={() => openStory(user)}
                >
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                    <div className="w-full h-full rounded-full bg-background p-0.5">
                      <img
                        // NOTE: Assumes you have this fallback image in your /public folder
                        src={user.avatar_url ?? '/default-avatar.png'} 
                        alt={user.username ?? 'User'}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium max-w-16 truncate">
                    {user.username}
                  </span>
                </div>
              ))}
            </div>
            {!storyLoading && !storyError && storyUsers.length === 0 && (
              <div className="text-sm text-muted-foreground px-1">No active stories right now.</div>
            )}
          </DataFeedback>
        </div>

        {/* --- Original Content --- */}
        <h1 className="text-2xl font-bold">Discover</h1>

        <Tabs defaultValue="communities" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="communities">Communities</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          {/* --- Communities Tab (Live Data + Load/Error) --- */}
          <TabsContent value="communities" className="space-y-3 mt-4">
            <DataFeedback
              isLoading={communityLoading}
              error={communityError}
              loadingText="Loading communities..."
              errorText="Could not load communities."
            >
              {communities.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No communities found.</p>
              )}
              {communities.map((community) => (
                <Card key={community.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {community.avatar_url ? (
                          <img src={community.avatar_url} alt={community.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{community.name}</h3>
                        {/* Handle potential null values from DB */}
                        <p className="text-sm text-muted-foreground">{community.member_count ?? 0} members</p>
                        <p className="text-sm mt-1">{community.description ?? 'No description.'}</p>
                      </div>
                      <Button size="sm">Join</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </DataFeedback>
          </TabsContent>

          {/* --- Events Tab (Live Data + Load/Error) --- */}
          <TabsContent value="events" className="space-y-3 mt-4">
            <DataFeedback
              isLoading={eventLoading}
              error={eventError}
              loadingText="Loading events..."
              errorText="Could not load events."
            >
              {events.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No events found.</p>
              )}
              {events.map((event) => {
                const { month, day, fullDate } = formatEventDate(event.event_date);
                return (
                  <Card key={event.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-white flex-shrink-0">
                          <div className="text-xs font-medium">{month}</div>
                          <div className="text-2xl font-bold">{day}</div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{event.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <Calendar className="w-4 h-4" />
                            <span>{fullDate}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location ?? 'Location TBD'}</span>
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

      {/* --- Story Viewer Modal --- */}
      {selectedStoryUser && (
        <StoryViewer user={selectedStoryUser} onClose={closeStory} />
      )}
    </>
  );
       }
      
