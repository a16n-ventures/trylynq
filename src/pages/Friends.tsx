import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, MessageSquare, UserPlus, Check, X, Filter, ArrowUpDown, Clock, Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- UTILS ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- TYPES ---
type Profile = {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  mutual_count?: number;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  requester: Profile;
  addressee: Profile;
};

type SortOption = 'newest' | 'alphabetical';

// --- SKELETON ---
const FriendSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-center gap-3 p-4 bg-muted/10 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="w-1/3 h-4 bg-muted animate-pulse rounded" />
          <div className="w-1/4 h-3 bg-muted/50 animate-pulse rounded" />
        </div>
      </div>
    ))}
  </div>
);

export default function Friends() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [activeTab, setActiveTab] = useState("all");
  const [requestView, setRequestView] = useState<'received' | 'sent'>('received');

  // --- QUERIES ---

  // 1. Friends (Accepted)
  const { data: friends = [], isPending: loadingFriends } = useQuery<Friendship[]>({
    queryKey: ['friends', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, requester_id, addressee_id, status, created_at, 
          requester:profiles!requester_id(user_id, display_name, avatar_url), 
          addressee:profiles!addressee_id(user_id, display_name, avatar_url)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted');
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // 2. Incoming (Received)
  const { data: incomingRequests = [], isPending: loadingIncoming } = useQuery<Friendship[]>({
    queryKey: ['friendRequests', 'incoming', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, requester_id, addressee_id, status, created_at, 
          requester:profiles!requester_id(user_id, display_name, avatar_url), 
          addressee:profiles!addressee_id(user_id, display_name, avatar_url)
        `)
        .eq('addressee_id', userId)
        .eq('status', 'pending');
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // 3. Outgoing (Sent) - CRITICAL FIX: StaleTime 0 ensures we fetch DB state on every mount
  const { data: outgoingRequests = [], isPending: loadingOutgoing } = useQuery<Friendship[]>({
    queryKey: ['friendRequests', 'outgoing', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, requester_id, addressee_id, status, created_at, 
          requester:profiles!requester_id(user_id, display_name, avatar_url), 
          addressee:profiles!addressee_id(user_id, display_name, avatar_url)
        `)
        .eq('requester_id', userId)
        .eq('status', 'pending');
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 0, // Always fetch fresh data on mount to verify persistence
  });

  // Helper: This is the source of truth for UI buttons
  const existingIds = useMemo(() => {
    const ids = new Set<string>();
    
    // Add Accepted Friends
    friends.forEach(f => ids.add(f.requester_id === userId ? f.addressee_id : f.requester_id));
    // Add Incoming Requesters
    incomingRequests.forEach(r => ids.add(r.requester_id));
    // Add Outgoing Addressees (People I sent to)
    outgoingRequests.forEach(r => ids.add(r.addressee_id));
    
    // Add Self
    if (userId) ids.add(userId);
    
    return ids;
  }, [friends, incomingRequests, outgoingRequests, userId]);

  // 4. Mutuals
  const { data: mutuals = [], isPending: loadingMutuals } = useQuery({
    queryKey: ['mutuals', userId],
    queryFn: async () => {
      if (!userId) return [];
      const myFriendIds = friends.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
      if (myFriendIds.length === 0) return [];

      const { data: fofData, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.in.(${myFriendIds.join(',')}),addressee_id.in.(${myFriendIds.join(',')})`)
        .eq('status', 'accepted')
        .limit(500);

      if (error) return [];

      const frequencyMap: Record<string, number> = {};
      fofData.forEach(rel => {
        const A = rel.requester_id;
        const B = rel.addressee_id;
        if (myFriendIds.includes(A) && !existingIds.has(B)) frequencyMap[B] = (frequencyMap[B] || 0) + 1;
        else if (myFriendIds.includes(B) && !existingIds.has(A)) frequencyMap[A] = (frequencyMap[A] || 0) + 1;
      });

      const sortedIds = Object.entries(frequencyMap).sort(([, a], [, b]) => b - a).slice(0, 20).map(([id]) => id);
      if (sortedIds.length === 0) return [];

      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', sortedIds);
      return profiles?.map(p => ({ ...p, mutual_count: frequencyMap[p.user_id] || 0 })).sort((a, b) => b.mutual_count - a.mutual_count) as Profile[] || [];
    },
    enabled: activeTab === 'mutual' && friends.length > 0,
  });

  // 5. Suggestions
  const { data: suggestions = [], isPending: loadingSuggestions } = useQuery<Profile[]>({
    queryKey: ['suggestions', userId, debouncedSearch],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase.from('profiles').select('*');
      if (debouncedSearch) query = query.ilike('display_name', `%${debouncedSearch}%`);
      
      // CRITICAL: Correctly filter out existing IDs
      const idList = Array.from(existingIds);
      if (idList.length > 0) {
         query = query.not('user_id', 'in', `(${idList.join(',')})`);
      }
      
      const { data } = await query.limit(20);
      return data || [];
    },
    enabled: activeTab === 'suggestions'
  });

  // --- MUTATIONS ---
    const sendFriendRequest = useMutation({
    mutationFn: async (targetProfile: Profile) => {
      if (!userId) throw new Error("Not authenticated");
      
      // Debugging: Check if IDs are valid
      console.log(`Sending request from ${userId} to ${targetProfile.user_id}`);

      const { data, error } = await supabase
        .from('friendships')
        .insert({ 
            requester_id: userId, 
            addressee_id: targetProfile.user_id, 
            status: 'pending' 
        })
        .select()
        .single();

      // Unique violation code (already requested) - Ignore error
      if (error && error.code === '23505') {
        console.log("Friend request already exists");
        return null; 
      }

      if (error) throw error;

      // Send Notification (Fire and forget)
      try {
        await supabase.from('notifications').insert({
          user_id: targetProfile.user_id,
          type: 'friend_request',
          title: 'New Friend Request',
          content: `You have a new friend request.`,
          data: { requester_id: userId },
        });
      } catch (e) { console.error("Notification failed", e); }
      
      return data;
    },
    onSuccess: () => {
      toast.success('Request sent');
      queryClient.invalidateQueries({ queryKey: ['friendRequests', 'outgoing'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
    onError: (error: any) => {
      console.error("Mutation Error Details:", error);
      // Show the REAL error message from Supabase
      toast.error(error.message || "Failed to send request");
    }
  });

  const acceptFriendRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Friend added!');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    }
  });

  const rejectFriendRequest = useMutation({
    mutationFn: async (id: string) => await supabase.from('friendships').delete().eq('id', id),
    onSuccess: () => {
        toast.info('Request removed');
        queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    }
  });

  const cancelSentRequest = useMutation({
    mutationFn: async (id: string) => await supabase.from('friendships').delete().eq('id', id),
    onSuccess: () => {
      toast.info('Request cancelled');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    }
  });

  // Render Profile Helper
  const renderProfile = (profile: Profile, subtext?: string) => (
    <>
      <Avatar className="w-12 h-12 border border-border/50">
        <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
        <AvatarFallback className="bg-muted text-muted-foreground">{profile.display_name?.[0] || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 text-left">
        <div className="font-semibold truncate">{profile.display_name}</div>
        {subtext && <div className="text-xs text-muted-foreground">{subtext}</div>}
      </div>
    </>
  );

  const filteredFriends = useMemo(() => {
    let res = [...friends];
    if (debouncedSearch) {
        res = res.filter(f => {
            const p = f.requester_id === userId ? f.addressee : f.requester;
            return p.display_name?.toLowerCase().includes(debouncedSearch.toLowerCase());
        });
    }
    res.sort((a, b) => {
       const pA = a.requester_id === userId ? a.addressee : a.requester;
       const pB = b.requester_id === userId ? b.addressee : b.requester;
       return sortOption === 'alphabetical' 
        ? (pA.display_name || '').localeCompare(pB.display_name || '') 
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return res;
  }, [friends, debouncedSearch, sortOption, userId]);

  return (
    <div className="container-mobile py-4 space-y-4 min-h-[80vh] pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search..."
            className="pl-10 bg-background/50 backdrop-blur-sm"
          />
           {search !== debouncedSearch && (
             <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOption('newest')}><ArrowUpDown className="mr-2 h-4 w-4" /> Newest</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('alphabetical')}><Filter className="mr-2 h-4 w-4" /> A-Z</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1 rounded-xl">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="requests" className="relative">
            Reqs
            {incomingRequests.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="mutual">Mutuals</TabsTrigger>
          <TabsTrigger value="suggestions">Add</TabsTrigger>
        </TabsList>

        {/* ALL FRIENDS */}
        <TabsContent value="all" className="mt-4 space-y-2">
          <Card className="border-0 shadow-none bg-transparent"><CardContent className="p-0">
            {loadingFriends ? <FriendSkeleton /> : filteredFriends.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No friends yet.</div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map(f => {
                  const p = f.requester_id === userId ? f.addressee : f.requester;
                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40 hover:bg-accent/5 cursor-pointer" onClick={() => navigate(`/messages?userId=${p.user_id}`)}>
                      {renderProfile(p, "Connected")}
                      <Button variant="ghost" size="icon"><MessageSquare className="w-5 h-5 text-primary" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* REQUESTS */}
        <TabsContent value="requests" className="mt-4">
          <div className="flex gap-2 mb-4 p-1 bg-muted/20 rounded-lg w-fit mx-auto">
            <button onClick={() => setRequestView('received')} className={`px-4 py-1.5 text-sm rounded-md transition-all ${requestView === 'received' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Received {incomingRequests.length > 0 && `(${incomingRequests.length})`}
            </button>
            <button onClick={() => setRequestView('sent')} className={`px-4 py-1.5 text-sm rounded-md transition-all ${requestView === 'sent' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Sent {outgoingRequests.length > 0 && `(${outgoingRequests.length})`}
            </button>
          </div>

          {requestView === 'received' && (
             <div className="space-y-2">
               {loadingIncoming ? <FriendSkeleton /> : incomingRequests.length === 0 ? <div className="text-center py-10 text-muted-foreground">No incoming requests.</div> : 
                 incomingRequests.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                        {renderProfile(r.requester, "Wants to connect")}
                        <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => rejectFriendRequest.mutate(r.id)}><X className="w-5 h-5" /></Button>
                            <Button size="icon" className="gradient-primary text-white rounded-full" onClick={() => acceptFriendRequest.mutate(r.id)}><Check className="w-5 h-5" /></Button>
                        </div>
                    </div>
                 ))
               }
             </div>
          )}

          {requestView === 'sent' && (
            <div className="space-y-2">
                {loadingOutgoing ? <FriendSkeleton /> : outgoingRequests.length === 0 ? <div className="text-center py-10 text-muted-foreground">No sent requests.</div> : 
                    outgoingRequests.map(r => (
                        <div key={r.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40 opacity-80">
                            {renderProfile(r.addressee, "Request sent")}
                            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => cancelSentRequest.mutate(r.id)}>Cancel</Button>
                        </div>
                    ))
                }
            </div>
          )}
        </TabsContent>

        {/* MUTUALS */}
        <TabsContent value="mutual" className="mt-4">
          <div className="space-y-2">
            {loadingMutuals ? <FriendSkeleton /> : mutuals.length === 0 ? <div className="text-center py-10 text-muted-foreground">No mutual connections.</div> : 
              mutuals.map((p) => {
                const isSent = existingIds.has(p.user_id);
                return (
                  <div key={p.user_id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                    {renderProfile(p, `${p.mutual_count} mutual friends`)}
                    <Button 
                        size="sm" 
                        variant={isSent ? "ghost" : "secondary"} 
                        disabled={isSent}
                        onClick={() => sendFriendRequest.mutate(p)}
                        className={isSent ? "text-green-600" : ""}
                    >
                      {isSent ? <> <Clock className="w-4 h-4 mr-1" /> Pending </> : <> <UserPlus className="w-4 h-4 mr-1" /> Add </>}
                    </Button>
                  </div>
                );
              })
            }
          </div>
        </TabsContent>

        {/* SUGGESTIONS */}
        <TabsContent value="suggestions" className="mt-4">
           <div className="space-y-2">
            {loadingSuggestions ? <FriendSkeleton /> : suggestions.length === 0 ? <div className="text-center py-10 text-muted-foreground">No suggestions.</div> : 
               suggestions.map(p => {
                 const isSent = existingIds.has(p.user_id);
                 return (
                   <div key={p.user_id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                     {renderProfile(p, "Suggested")}
                     <Button 
                        size="sm" 
                        className={isSent ? "bg-transparent border border-primary/20 text-muted-foreground" : "gradient-primary text-white"}
                        variant={isSent ? "outline" : "default"}
                        disabled={isSent}
                        onClick={() => sendFriendRequest.mutate(p)}
                     >
                       {isSent ? <> <Clock className="w-4 h-4 mr-1" /> Pending </> : <> <UserPlus className="w-4 h-4 mr-1" /> Add </>}
                     </Button>
                   </div>
                 );
               })
            }
           </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
