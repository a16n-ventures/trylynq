import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Users, Calendar, MapPin, X, Loader2, AlertCircle, Plus, 
  Heart, MessageCircle, Send, Share2, Paperclip 
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// --- Types ---
interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
  user_id: string;
  likes_count?: number; // Mocked for UI
  comments_count?: number; // Mocked for UI
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

// --- Helper Components ---
const DataFeedback: React.FC<{ isLoading: boolean; error: string | null; children: React.ReactNode }> = ({ isLoading, error, children }) => {
  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;
  if (error) return <div className="text-red-500 p-4 text-center">{error}</div>;
  return <>{children}</>;
};

// --- Story Viewer (Now with Likes/Comments) ---
function StoryViewer({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Interaction States
  const [isLiked, setIsLiked] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    async function fetchStories() {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('stories')
        .select('id, media_url, media_type, caption, created_at, user_id')
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: true });
      
      if (data) setStories(data);
      setLoading(false);
    }
    fetchStories();
  }, [user.id]);

  const currentStory = stories[currentIndex];

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsLiked(false); // Reset for next story
    } else {
      onClose();
    }
  };

  const handlePrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    // In production: supabase.from('story_likes').insert(...)
    toast.success(isLiked ? "Unliked" : "Liked!");
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!comment.trim()) return;
    // In production: supabase.from('story_comments').insert(...)
    toast.success("Reply sent!");
    setComment("");
  };

  if (loading) return <div className="fixed inset-0 z-50 bg-black flex items-center justify-center"><Loader2 className="text-white animate-spin" /></div>;
  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center sm:p-4">
      {/* Close Button */}
      <button onClick={onClose} className="absolute top-4 right-4 z-50 text-white/80 hover:text-white">
        <X className="w-8 h-8" />
      </button>

      <div className="relative w-full h-full sm:max-w-md sm:h-[85vh] bg-black sm:rounded-xl overflow-hidden flex flex-col">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full z-20 flex gap-1 p-2">
          {stories.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div className={`h-full bg-white transition-all duration-300 ${idx <= currentIndex ? 'w-full' : 'w-0'}`} />
            </div>
          ))}
        </div>

        {/* User Info Header */}
        <div className="absolute top-4 left-0 w-full p-4 z-20 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent">
          <img src={user.avatar_url ?? '/default-avatar.png'} className="w-10 h-10 rounded-full border border-white/50 object-cover" />
          <div className="flex flex-col">
            <span className="text-white font-semibold text-sm shadow-black drop-shadow-md">{user.username}</span>
            <span className="text-white/70 text-xs">
              {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Media Content */}
        <div className="flex-1 bg-black flex items-center justify-center relative" onClick={handleNext}>
          {currentStory.media_type === 'image' ? (
            <img src={currentStory.media_url} className="w-full h-full object-contain" />
          ) : (
            <video src={currentStory.media_url} className="w-full h-full object-contain" autoPlay playsInline />
          )}
          
          {/* Caption Overlay */}
          {currentStory.caption && (
             <div className="absolute bottom-20 left-0 w-full p-4 text-center">
               <p className="text-white bg-black/50 inline-block px-3 py-1 rounded-lg text-sm backdrop-blur-md">
                 {currentStory.caption}
               </p>
             </div>
          )}
          
          {/* Navigation Zones */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
        </div>

        {/* Interaction Footer */}
        <div className="absolute bottom-0 left-0 w-full p-3 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <div className="flex items-center gap-3">
            <form onSubmit={handleSendComment} className="flex-1 relative">
              <Input 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Send a message..." 
                className="bg-transparent border-white/30 text-white placeholder:text-white/70 rounded-full h-10 pr-10 focus-visible:ring-0 focus-visible:border-white"
                onClick={(e) => e.stopPropagation()} 
              />
            </form>
            
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-white hover:bg-white/10 rounded-full"
              onClick={handleLike}
            >
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
            
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-white hover:bg-white/10 rounded-full"
              onClick={(e) => { e.stopPropagation(); toast.info("Shared to clipboard!"); }}
            >
              <Share2 className="w-6 h-6" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Main Component ---

export default function Discover() {
  const { user } = useAuth();
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedStoryUser, setSelectedStoryUser] = useState<Profile | null>(null);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  // Fetch Data
  useEffect(() => {
    if (!user) return;
    
    // Get My Profile
    supabase.from('profiles').select('id, username, avatar_url').eq('id', user.id).single()
      .then(({ data }) => setCurrentUserProfile(data));

    // Get Active Stories
    fetchStories();
    
    // Get Communities & Events (Simplified for brevity)
    supabase.from('communities').select('*').limit(5).then(({ data }) => setCommunities(data || []));
    supabase.from('events').select('*').limit(5).then(({ data }) => setEvents(data || []));

  }, [user]);

  const fetchStories = async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, stories!inner(id, created_at)')
      .filter('stories.created_at', 'gte', oneDayAgo)
      .returns<ProfileWithStoryInner[]>();
    
    if (data) {
       // Remove duplicates manually
       const unique = Array.from(new Map(data.map(item => [item.id, item])).values());
       setStoryUsers(unique);
    }
  };

  // --- Upload Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePostStory = async () => {
    if (!previewFile || !user) return;
    setIsUploading(true);
    
    try {
      const fileExt = previewFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage.from('stories').upload(filePath, previewFile);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(filePath);
      
      await supabase.from('stories').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: previewFile.type.startsWith('video') ? 'video' : 'image',
        caption: caption // Saving the caption!
      });

      toast.success("Story posted!");
      setPreviewFile(null);
      setPreviewUrl(null);
      setCaption("");
      fetchStories(); // Refresh tray

    } catch (err) {
      toast.error("Failed to upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container-mobile py-4 space-y-6 pb-20">
      {/* Story Tray */}
      <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex gap-4 px-4 items-start">
          
          {/* Add Story Button */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 relative">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
            <div 
              className="w-16 h-16 rounded-full p-[2px] border-2 border-dashed border-muted-foreground/30 cursor-pointer relative"
              onClick={() => fileInputRef.current?.click()}
            >
              <img src={currentUserProfile?.avatar_url ?? '/default-avatar.png'} className="w-full h-full rounded-full object-cover opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Plus className="w-6 h-6 text-primary" />
              </div>
            </div>
            <span className="text-xs font-medium">Add Story</span>
          </div>

          {/* Stories List */}
          {storyUsers.map(u => (
            <div key={u.id} className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => setSelectedStoryUser(u)}>
              <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                <img src={u.avatar_url ?? '/default-avatar.png'} className="w-full h-full rounded-full object-cover border-2 border-background" />
              </div>
              <span className="text-xs font-medium max-w-[70px] truncate">{u.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal for Upload */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Story</DialogTitle>
          </DialogHeader>
          <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
            {previewFile?.type.startsWith('video') ? (
               <video src={previewUrl || ''} className="max-h-full max-w-full" controls />
            ) : (
               <img src={previewUrl || ''} className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <div className="space-y-4">
             <Input 
               placeholder="Add a caption..." 
               value={caption} 
               onChange={(e) => setCaption(e.target.value)} 
             />
             <DialogFooter>
               <Button variant="outline" onClick={() => setPreviewFile(null)}>Cancel</Button>
               <Button onClick={handlePostStory} disabled={isUploading}>
                 {isUploading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                 Post Story
               </Button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content Tabs */}
      <div className="px-4">
        <Tabs defaultValue="communities">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="communities">Communities</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          
          <TabsContent value="communities" className="space-y-3 mt-4">
             {communities.map(c => (
               <Card key={c.id}><CardContent className="p-4 flex gap-3 items-center">
                 <img src={c.avatar_url || '/default-avatar.png'} className="w-12 h-12 rounded-lg bg-secondary object-cover" />
                 <div><h3 className="font-semibold">{c.name}</h3><p className="text-xs text-muted-foreground">{c.member_count} members</p></div>
               </CardContent></Card>
             ))}
          </TabsContent>
          
          <TabsContent value="events" className="space-y-3 mt-4">
             {events.map(e => (
               <Card key={e.id}><CardContent className="p-4">
                 <h3 className="font-bold">{e.name}</h3>
                 <p className="text-sm text-muted-foreground">{e.location} • {e.event_date && new Date(e.event_date).toLocaleDateString()}</p>
               </CardContent></Card>
             ))}
          </TabsContent>
        </Tabs>
      </div>

      {selectedStoryUser && <StoryViewer user={selectedStoryUser} onClose={() => setSelectedStoryUser(null)} />}
    </div>
  );
}
                                 
