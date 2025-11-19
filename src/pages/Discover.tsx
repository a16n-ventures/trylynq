import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Users, Calendar, MapPin, X, Loader2, Plus, 
  Heart, Share2, Sparkles, Lock, RefreshCw
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// --- TYPES (UPDATED TO MATCH DB) ---
interface Profile { id: string; username: string | null; avatar_url: string | null; }
interface Story { id: string; media_url: string; media_type: 'image' | 'video'; caption?: string; created_at: string; user_id: string; }
interface Community { id: string; name: string; member_count: number | null; description: string | null; avatar_url: string | null; }

// FIX: Updated to match 'events' table columns
interface Event { 
  id: string; 
  title: string;       // Changed from 'name'
  start_date: string;  // Changed from 'event_date'
  location: string | null; 
  image_url?: string; 
  match_score?: number; 
}

type ProfileWithStoryInner = Profile & { stories: { id: string; created_at: string }[]; };

// --- UI COMPONENTS ---
const FeedSkeleton = () => (
  <div className="space-y-4">
    {[1, 2].map(i => (
      <Card key={i} className="border-0 shadow-sm bg-card/50">
        <CardContent className="p-4 flex gap-4 items-center">
          <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
            <div className="h-3 w-1/3 bg-muted/50 animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const EmptyState = ({ icon: Icon, title, desc, action, onAction }: any) => (
  <Card className="border-2 border-dashed border-muted bg-muted/5 shadow-none py-8">
    <CardContent className="flex flex-col items-center text-center space-y-3">
      <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-2"><Icon className="w-8 h-8 text-muted-foreground/50" /></div>
      <h3 className="font-semibold text-lg text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto">{desc}</p>
      {action && <Button variant="outline" className="mt-4" onClick={onAction}>{action}</Button>}
    </CardContent>
  </Card>
);

function StoryViewer({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      const yesterday = new Date(Date.now() - 864e5).toISOString();
      const { data } = await supabase.from('stories').select('id, media_url, media_type, caption, created_at, user_id').eq('user_id', user.id).gte('created_at', yesterday).order('created_at', { ascending: true });
      if (data) setStories(data);
      setLoading(false);
    };
    load();
  }, [user.id]);

  const current = stories[index];
  const next = () => index < stories.length - 1 ? (setIndex(i => i + 1), setLiked(false)) : onClose();
  const prev = () => setIndex(i => Math.max(i - 1, 0));

  if (loading) return <div className="fixed inset-0 z-50 bg-black flex items-center justify-center"><Loader2 className="text-white animate-spin" /></div>;
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center sm:p-4 animate-in fade-in duration-300">
      <button onClick={onClose} className="absolute top-6 right-6 z-50 text-white/80 hover:text-white"><X className="w-8 h-8" /></button>
      <div className="relative w-full h-full sm:max-w-md sm:h-[85vh] bg-black sm:rounded-2xl overflow-hidden flex flex-col border border-white/10 shadow-2xl">
        <div className="absolute top-0 w-full z-20 flex gap-1 p-2">
          {stories.map((_, i) => <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"><div className={`h-full bg-white transition-all duration-300 ${i <= index ? 'w-full' : 'w-0'}`} /></div>)}
        </div>
        <div className="absolute top-6 left-0 w-full p-4 z-20 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent">
          <img src={user.avatar_url || '/default-avatar.png'} className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
          <span className="text-white font-bold text-sm drop-shadow-md">{user.username}</span>
        </div>
        <div className="flex-1 flex items-center justify-center bg-black relative" onClick={next}>
          {current.media_type === 'video' ? <video src={current.media_url} className="w-full h-full object-contain" autoPlay playsInline /> : <img src={current.media_url} className="w-full h-full object-contain" />}
          {current.caption && <div className="absolute bottom-24 w-full text-center px-6"><span className="bg-black/40 text-white px-4 py-2 rounded-xl backdrop-blur-md text-lg font-medium inline-block">{current.caption}</span></div>}
          <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={(e) => { e.stopPropagation(); prev(); }} />
        </div>
        <div className="absolute bottom-0 w-full p-4 z-30 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex gap-3 pb-8">
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Reply..." className="bg-white/10 border-white/10 text-white placeholder:text-white/60 rounded-full backdrop-blur-md focus-visible:ring-0" onClick={(e) => e.stopPropagation()} />
          <Button size="icon" variant="ghost" className="text-white rounded-full hover:bg-white/10" onClick={(e) => { e.stopPropagation(); setLiked(!liked); toast.success("Reaction sent ❤️"); }}><Heart className={`w-7 h-7 transition-transform active:scale-125 ${liked ? 'fill-red-500 text-red-500' : ''}`} /></Button>
          <Button size="icon" variant="ghost" className="text-white rounded-full hover:bg-white/10"><Share2 className="w-7 h-7" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [smartFeed, setSmartFeed] = useState<Event[]>([]);
  const [selectedStory, setSelectedStory] = useState<Profile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  
  const [preview, setPreview] = useState<{ file: File, url: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      // 1. Profiles
      const { data: me } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUserProfile(me);
      
      const yesterday = new Date(Date.now() - 864e5).toISOString();
      const { data: storyData } = await supabase.from('profiles').select('id, username, avatar_url, stories!inner(id, created_at)').filter('stories.created_at', 'gte', yesterday).returns<ProfileWithStoryInner[]>();
      if (storyData) setStoryUsers(Array.from(new Map(storyData.map(i => [i.id, i])).values()));

      // 2. Communities
      const { data: comms } = await supabase.from('communities').select('*').limit(5);
      setCommunities(comms || []);
      
      // 3. Events (FIX: Use CORRECT DB Column Names)
      // We select all (*) so title and start_date come through.
      // We map them manually below to match our UI interface.
      const { data: evts } = await supabase
        .from('events')
        .select('*')
        .gte('start_date', new Date().toISOString())
        .limit(5);
      
      if (evts) {
        // Map DB columns (title, start_date) to UI Types (name, event_date)
        const mappedEvents: Event[] = evts.map((e: any) => ({
          id: e.id,
          title: e.title,          // UI expects title now
          start_date: e.start_date,// UI expects start_date now
          location: e.location,
          image_url: e.image_url
        }));
        setEvents(mappedEvents);
      }

      // 4. Premium & AI
      const { data: sub } = await supabase.from('subscriptions').select('status').eq('user_id', user.id).single();
      const prem = sub?.status === 'active';
      setIsPremium(prem);

      if (prem) {
        const { data: ai } = await supabase.rpc('get_smart_feed', { viewer_id: user.id, user_lat: 6.5, user_long: 3.3, user_interests: ['tech'] });
        if (ai) {
          const formatted: Event[] = ai.map((item: any) => ({
            id: item.id,
            title: item.title,      // Map RPC title
            start_date: item.start_date, // Map RPC start_date
            location: item.location,
            image_url: item.image_url,
            match_score: item.match_score
          }));
          setSmartFeed(formatted);
        }
      }

      setLoading(false);
    };
    init();
  }, [user]);

  const handleUpload = async () => {
    if (!preview || !user) return;
    setUploading(true);
    try {
      const ext = preview.file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      await supabase.storage.from('stories').upload(path, preview.file);
      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(path);
      await supabase.from('stories').insert({ user_id: user.id, media_url: publicUrl, media_type: preview.file.type.startsWith('video') ? 'video' : 'image', caption });
      toast.success("Story posted!");
      setPreview(null);
      window.location.reload();
    } catch (e) { toast.error("Upload failed"); }
    setUploading(false);
  };

  return (
    <div className="container-mobile py-4 space-y-6 pb-24">
      {/* STORIES TRAY */}
      <div className="w-full overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
        {loading ? <div className="flex gap-4"><div className="w-16 h-16 bg-muted rounded-full animate-pulse" /></div> : (
          <div className="flex gap-4 items-start">
            <div className="flex flex-col items-center gap-2 flex-shrink-0 relative cursor-pointer group" onClick={() => fileRef.current?.click()}>
              <input type="file" ref={fileRef} className="hidden" accept="image/*,video/*" onChange={(e) => e.target.files?.[0] && setPreview({ file: e.target.files[0], url: URL.createObjectURL(e.target.files[0]) })} />
              <div className="w-16 h-16 rounded-full p-[2px] border-2 border-dashed border-muted-foreground/30 relative group-hover:border-primary transition-colors">
                <img src={currentUserProfile?.avatar_url || '/default-avatar.png'} className="w-full h-full rounded-full object-cover opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center bg-background/20 rounded-full"><Plus className="w-6 h-6 text-primary drop-shadow-sm" /></div>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Add Story</span>
            </div>
            {storyUsers.map(u => u.id !== user?.id && (
              <div key={u.id} className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 group" onClick={() => setSelectedStory(u)}>
                <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-yellow-400 via-orange-500 to-purple-600 group-hover:scale-105 transition-transform shadow-sm">
                  <img src={u.avatar_url || '/default-avatar.png'} className="w-full h-full rounded-full object-cover border-2 border-background" />
                </div>
                <span className="text-xs font-medium max-w-[70px] truncate">{u.username}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-0">
          <DialogHeader><DialogTitle>Create Story</DialogTitle></DialogHeader>
          <div className="aspect-[9/16] bg-black/10 rounded-xl overflow-hidden flex items-center justify-center relative border">
            {preview?.file.type.startsWith('video') ? <video src={preview.url} controls className="max-h-full max-w-full" /> : <img src={preview?.url} className="max-h-full max-w-full object-contain" />}
          </div>
          <div className="space-y-4 pt-2">
            <Input placeholder="Add a caption..." value={caption} onChange={e => setCaption(e.target.value)} className="bg-muted/50 border-0" />
            <DialogFooter className="gap-2"><Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button><Button onClick={handleUpload} disabled={uploading} className="gradient-primary text-white">{uploading ? <Loader2 className="animate-spin" /> : 'Share to Story'}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* TABS */}
      <div className="px-1">
        <h1 className="text-2xl font-bold mb-4 tracking-tight">Discover</h1>
        <Tabs defaultValue="communities">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="communities" className="rounded-lg">Communities</TabsTrigger>
            <TabsTrigger value="events" className="rounded-lg">Events</TabsTrigger>
            <TabsTrigger value="foryou" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg"><Sparkles className="w-3 h-3 mr-1" /> For You</TabsTrigger>
          </TabsList>

          {/* Communities */}
          <TabsContent value="communities" className="mt-6 space-y-3 animate-in fade-in-50">
            {loading ? <FeedSkeleton /> : communities.length === 0 ? (
              <EmptyState icon={Users} title="No Communities Yet" desc="Be the first to start a tribe in your area." action="Create Community" onAction={() => navigate('/app/messages')} />
            ) : (
              communities.map(c => (
                <Card key={c.id} className="hover:shadow-md transition-all border-border/50 cursor-pointer"><CardContent className="p-4 flex gap-4 items-center">
                    <img src={c.avatar_url || '/default-avatar.png'} className="w-14 h-14 rounded-2xl bg-muted object-cover" />
                    <div className="flex-1 min-w-0"><h3 className="font-semibold truncate text-lg">{c.name}</h3><p className="text-sm text-muted-foreground line-clamp-1">{c.description}</p><div className="flex items-center gap-1 mt-1 text-xs text-primary font-medium"><Users className="w-3 h-3" /> {c.member_count} members</div></div>
                    <Button size="sm" variant="secondary" className="rounded-full px-4">Join</Button>
                </CardContent></Card>
              ))
            )}
          </TabsContent>

          {/* Events (FIXED UI TO USE TITLE/START_DATE) */}
          <TabsContent value="events" className="mt-6 space-y-3 animate-in fade-in-50">
            {loading ? <FeedSkeleton /> : events.length === 0 ? (
               <EmptyState icon={Calendar} title="No Upcoming Events" desc="It's quiet... too quiet. Host a party!" action="Create Event" onAction={() => navigate('/create-event')} />
            ) : (
              events.map(e => (
                <Card key={e.id} className="hover:shadow-md transition-all border-border/50"><CardContent className="p-4 flex items-center gap-4">
                    <div className="w-14 h-16 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center text-primary flex-shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{new Date(e.start_date).toLocaleString('default', {month:'short'})}</span>
                      <span className="text-xl font-bold leading-none">{new Date(e.start_date).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0"><h3 className="font-bold text-base truncate">{e.title}</h3><div className="flex items-center gap-1 text-sm text-muted-foreground mt-1"><MapPin className="w-3.5 h-3.5" /> <span className="truncate">{e.location}</span></div></div>
                    <Button size="sm" variant="outline" className="rounded-full">View</Button>
                </CardContent></Card>
              ))
            )}
          </TabsContent>

          {/* For You (AI) */}
          <TabsContent value="foryou" className="mt-6 space-y-4 animate-in fade-in-50">
            {!isPremium ? (
              <Card className="bg-gradient-to-br from-indigo-900 to-purple-900 border-0 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                <CardContent className="flex flex-col items-center justify-center py-12 text-center relative z-10">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 backdrop-blur-md shadow-inner border border-white/20"><Lock className="w-8 h-8 text-white drop-shadow-lg" /></div>
                  <h3 className="text-xl font-bold mb-2">Unlock AI Insights</h3>
                  <p className="text-white/70 max-w-xs mb-6 text-sm leading-relaxed">See events matched to your interests.</p>
                  <Button variant="secondary" className="font-bold shadow-lg" onClick={() => navigate('/premium')}>Upgrade to Premium</Button>
                </CardContent>
              </Card>
            ) : smartFeed.length === 0 ? (
               <EmptyState icon={RefreshCw} title="Analyzing..." desc="AI is learning your preferences." action="Refresh" onAction={() => window.location.reload()} />
            ) : (
              smartFeed.map(e => (
                <Card key={e.id} className="overflow-hidden border-purple-200 dark:border-purple-900 shadow-sm hover:shadow-md transition-all">
                  <div className="h-32 bg-muted relative">
                    {e.image_url && <img src={e.image_url} className="w-full h-full object-cover" />}
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-md flex gap-1 font-bold items-center"><Sparkles className="w-3 h-3 text-yellow-400" /> {(e.match_score || 95).toFixed(0)}% Match</div>
                  </div>
                  <CardContent className="p-4"><h3 className="font-bold truncate text-lg">{e.title}</h3><p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {e.location}</p></CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
      {selectedStory && <StoryViewer user={selectedStory} onClose={() => setSelectedStory(null)} />}
    </div>
  );
}
