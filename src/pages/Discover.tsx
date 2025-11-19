import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Users, Calendar, MapPin, X, Loader2, Plus, 
  Heart, Share2, Sparkles, Search
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// --- Types ---
interface Profile { id: string; username: string | null; avatar_url: string | null; }
interface Story { id: string; media_url: string; media_type: 'image' | 'video'; caption?: string; created_at: string; user_id: string; }
interface Community { id: string; name: string; member_count: number | null; description: string | null; avatar_url: string | null; }
interface Event { id: string; name: string; event_date: string | null; location: string | null; }
type ProfileWithStoryInner = Profile & { stories: { id: string; created_at: string }[]; };

// --- UI Components ---

// 1. SKELETON LOADER (The "Shimmer")
const SkeletonCard = () => (
  <Card className="mb-3 border-0 shadow-none bg-muted/10">
    <CardContent className="p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
        <div className="h-3 w-1/2 bg-muted/50 animate-pulse rounded" />
      </div>
    </CardContent>
  </Card>
);

const StorySkeleton = () => (
  <div className="flex gap-4 px-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
        <div className="h-2 w-12 bg-muted animate-pulse rounded" />
      </div>
    ))}
  </div>
);

// 2. STORY VIEWER (Unchanged Logic, Visual Polish)
function StoryViewer({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const fetchStories = async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('stories')
        .select('id, media_url, media_type, caption, created_at, user_id')
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: true });
      if (data) setStories(data);
      setLoading(false);
    };
    fetchStories();
  }, [user.id]);

  const currentStory = stories[currentIndex];

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsLiked(false);
    } else {
      onClose();
    }
  };

  const handlePrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  if (loading) return <div className="fixed inset-0 z-50 bg-black flex items-center justify-center"><Loader2 className="text-white animate-spin" /></div>;
  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <button onClick={onClose} className="absolute top-6 right-6 z-50 text-white/80 hover:text-white">
        <X className="w-8 h-8 drop-shadow-md" />
      </button>

      <div className="relative w-full h-full sm:max-w-md sm:h-[85vh] bg-black sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/10">
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 w-full z-20 flex gap-1.5 p-3">
          {stories.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div className={`h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-300 ${idx <= currentIndex ? 'w-full' : 'w-0'}`} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 w-full p-4 z-20 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent pt-8">
          <img src={user.avatar_url ?? '/default-avatar.png'} className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm drop-shadow-md">{user.username}</span>
            <span className="text-white/60 text-xs font-medium">
              {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Media */}
        <div className="flex-1 bg-black flex items-center justify-center relative" onClick={handleNext}>
          {currentStory.media_type === 'image' ? (
            <img src={currentStory.media_url} className="w-full h-full object-contain" />
          ) : (
            <video src={currentStory.media_url} className="w-full h-full object-contain" autoPlay playsInline />
          )}
          
          {currentStory.caption && (
             <div className="absolute bottom-24 left-0 w-full p-6 text-center z-20">
               <p className="text-white bg-black/40 inline-block px-4 py-2 rounded-2xl text-lg backdrop-blur-md font-medium">
                 {currentStory.caption}
               </p>
             </div>
          )}
          <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 w-full p-4 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-8">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Input 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Send a message..." 
                className="bg-white/10 border-white/10 text-white placeholder:text-white/50 rounded-full h-12 pl-5 pr-10 focus-visible:ring-0 focus-visible:border-white/50 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()} 
              />
            </div>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full h-12 w-12" onClick={(e) => { e.stopPropagation(); setIsLiked(!isLiked); toast.success(isLiked ? "Unliked" : "Liked!"); }}>
              <Heart className={`w-7 h-7 transition-all ${isLiked ? 'fill-red-500 text-red-500 scale-110' : ''}`} />
            </Button>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full h-12 w-12">
              <Share2 className="w-7 h-7" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
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

  // Loading States
  const [loadingStories, setLoadingStories] = useState(true);
  const [loadingFeeds, setLoadingFeeds] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      // 1. User & Stories
      const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', user.id).single();
      setCurrentUserProfile(profile);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: stories } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, stories!inner(id, created_at)')
        .filter('stories.created_at', 'gte', oneDayAgo)
        .returns<ProfileWithStoryInner[]>();
      
      if (stories) {
         const unique = Array.from(new Map(stories.map(item => [item.id, item])).values());
         setStoryUsers(unique);
      }
      setLoadingStories(false);

      // 2. Feeds
      const { data: comms } = await supabase.from('communities').select('*').limit(5);
      const { data: evts } = await supabase.from('events').select('*').limit(5);
      setCommunities(comms || []);
      setEvents(evts || []);
      setLoadingFeeds(false);
    };

    loadData();
  }, [user]);

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
        caption: caption
      });

      toast.success("Story posted!");
      setPreviewFile(null);
      // Optimistic update could go here, but simple refresh works:
      window.location.reload(); 
    } catch (err) {
      toast.error("Failed to upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container-mobile py-4 space-y-6 pb-20">
      {/* Story Tray */}
      <div className="w-full overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
        {loadingStories ? <StorySkeleton /> : (
          <div className="flex gap-4 items-start">
            {/* Add Story */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0 relative group">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
              <div 
                className="w-16 h-16 rounded-full p-[2px] border-2 border-dashed border-muted-foreground/30 cursor-pointer relative hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <img src={currentUserProfile?.avatar_url ?? '/default-avatar.png'} className="w-full h-full rounded-full object-cover opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center bg-background/20 rounded-full">
                  <Plus className="w-6 h-6 text-primary drop-shadow-sm" />
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Add Story</span>
            </div>

            {/* Stories List */}
            {storyUsers.map(u => {
              if (u.id === user?.id) return null; // Skip self in list
              return (
                <div key={u.id} className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 group" onClick={() => setSelectedStoryUser(u)}>
                  <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-yellow-400 via-orange-500 to-purple-600 group-hover:scale-105 transition-transform shadow-sm">
                    <img src={u.avatar_url ?? '/default-avatar.png'} className="w-full h-full rounded-full object-cover border-2 border-background" />
                  </div>
                  <span className="text-xs font-medium max-w-[70px] truncate">{u.username}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Preview Modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="sm:max-w-md border-0 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Create Story</DialogTitle>
          </DialogHeader>
          <div className="aspect-[9/16] bg-black/5 rounded-xl overflow-hidden relative flex items-center justify-center border">
            {previewFile?.type.startsWith('video') ? (
               <video src={previewUrl || ''} className="max-h-full max-w-full" controls />
            ) : (
               <img src={previewUrl || ''} className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <div className="space-y-4 pt-2">
             <Input 
               placeholder="Write a caption..." 
               value={caption} 
               onChange={(e) => setCaption(e.target.value)} 
               className="border-0 bg-muted/50 focus-visible:ring-0"
             />
             <DialogFooter className="gap-2">
               <Button variant="ghost" onClick={() => setPreviewFile(null)}>Discard</Button>
               <Button onClick={handlePostStory} disabled={isUploading} className="gradient-primary text-white">
                 {isUploading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                 Share to Story
               </Button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Tabs */}
      <div className="px-1">
        <h1 className="text-2xl font-bold mb-4 tracking-tight">Discover</h1>
        <Tabs defaultValue="communities" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="communities" className="rounded-lg">Communities</TabsTrigger>
            <TabsTrigger value="events" className="rounded-lg">Events</TabsTrigger>
          </TabsList>
          
          {/* Communities Tab */}
          <TabsContent value="communities" className="space-y-3 mt-6 animate-in fade-in-50">
             {loadingFeeds ? (
               <> <SkeletonCard /> <SkeletonCard /> </>
             ) : communities.length === 0 ? (
               <div className="text-center py-12 border-2 border-dashed border-muted rounded-2xl bg-muted/5">
                 <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                 <p className="text-muted-foreground font-medium">No communities yet.</p>
               </div>
             ) : (
               communities.map(c => (
                 <Card key={c.id} className="group hover:shadow-md transition-all border-border/50">
                   <CardContent className="p-4 flex gap-4 items-center">
                     <img src={c.avatar_url || '/default-avatar.png'} className="w-14 h-14 rounded-2xl bg-muted object-cover group-hover:scale-105 transition-transform" />
                     <div className="flex-1 min-w-0">
                       <h3 className="font-semibold truncate text-lg">{c.name}</h3>
                       <p className="text-sm text-muted-foreground line-clamp-1">{c.description}</p>
                       <div className="flex items-center gap-1 mt-1 text-xs text-primary font-medium">
                         <Users className="w-3 h-3" /> {c.member_count?.toLocaleString()} members
                       </div>
                     </div>
                     <Button size="sm" variant="secondary" className="rounded-full px-4">Join</Button>
                   </CardContent>
                 </Card>
               ))
             )}
          </TabsContent>
          
          {/* Events Tab */}
          <TabsContent value="events" className="space-y-3 mt-6 animate-in fade-in-50">
             {loadingFeeds ? (
               <> <SkeletonCard /> <SkeletonCard /> </>
             ) : events.length === 0 ? (
               <div className="text-center py-12 border-2 border-dashed border-muted rounded-2xl bg-muted/5">
                 <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                 <p className="text-muted-foreground font-medium">No upcoming events.</p>
               </div>
             ) : (
               events.map(e => (
                 <Card key={e.id} className="hover:shadow-md transition-all border-border/50">
                   <CardContent className="p-4 flex items-center gap-4">
                     <div className="w-14 h-16 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center text-primary flex-shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
                          {new Date(e.event_date!).toLocaleString('default', { month: 'short' })}
                        </span>
                        <span className="text-xl font-bold leading-none">
                          {new Date(e.event_date!).getDate()}
                        </span>
                     </div>
                     <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-base truncate">{e.name}</h3>
                       <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="w-3.5 h-3.5" /> <span className="truncate">{e.location}</span>
                       </div>
                     </div>
                     <Button size="sm" variant="outline" className="rounded-full">View</Button>
                   </CardContent>
                 </Card>
               ))
             )}
          </TabsContent>
        </Tabs>
      </div>

      {selectedStoryUser && <StoryViewer user={selectedStoryUser} onClose={() => setSelectedStoryUser(null)} />}
    </div>
  );
}
      
