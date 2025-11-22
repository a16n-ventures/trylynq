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

// --- SKELETON COMPONENT ---
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

// --- COMPONENT ---
export default function Friends() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // State
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500); // 500ms delay for production performance
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [activeTab, setActiveTab] = useState("all");
  const [requestView, setRequestView] = useState<'received' | 'sent'>('received');

  // Tracks optimistic updates locally to prevent UI flickering
  const [optimisticPendingIds, setOptimisticPendingIds] = useState<Set<string>>(new Set());

  // --- REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`friendship_updates_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['friends'] });
          queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') toast.info("New friend request received!");
          queryClient.invalidateQueries({ queryKey: ['friends'] });
          queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  // --- QUERIES ---

  // 1. Fetch ACCEPTED friends
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
    staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
  });

  // 2. Fetch INCOMING requests
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

  // 3. Fetch OUTGOING requests
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
    enabled: !!userId
  });

  // Helper to calculate IDs to exclude from suggestions
  const existingIds = useMemo(() => {
    const fIds = friends.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
    const incomingIds = incomingRequests.map(r => r.requester_id);
    const outgoingIds = outgoingRequests.map(r => r.addressee_id);
    // Also exclude optimistic pending IDs
    return new Set([...fIds, ...incomingIds, ...outgoingIds, ...Array.from(optimisticPendingIds), userId]);
  }, [friends, incomingRequests, outgoingRequests, optimisticPendingIds, userId]);

  // 4. MUTUALS QUERY
  const { data: mutuals = [], isPending: loadingMutuals } = useQuery({
    queryKey: ['mutuals', userId],
    queryFn: async () => {
      if (!userId) return [];
      const myFriendIds = friends.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
      if (myFriendIds.length === 0) return [];

      // Fetch friendships of friends (Limit to avoid performance hit on client-side join)
      const { data: fofData, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.in.(${myFriendIds.join(',')}),addressee_id.in.(${myFriendIds.join(',')})`)
        .eq('status', 'accepted')
        .limit(500); // Increased limit slightly

      if (error) return [];

      const frequencyMap: Record<string, number> = {};
      
      fofData.forEach(rel => {
        const personA = rel.requester_id;
        const personB = rel.addressee_id;
        
        if (myFriendIds.includes(personA) && !existingIds.has(personB)) {
             frequencyMap[personB] = (frequencyMap[personB] || 0) + 1;
        }
        else if (myFriendIds.includes(personB) && !existingIds.has(personA)) {
             frequencyMap[personA] = (frequencyMap[personA] || 0) + 1;
        }
      });

      const sortedIds = Object.entries(frequencyMap)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 20)
        .map(([id]) => id);

      if (sortedIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', sortedIds);

      return profiles?.map(p => ({
        ...p,
        mutual_count: frequencyMap[p.user_id] || 0
      })).sort((a, b) => b.mutual_count - a.mutual_count) as Profile[] || [];
    },
    enabled: activeTab === 'mutual' && friends.length > 0,
    staleTime: 1000 * 60 * 10 
  });

  // 5. Suggestions
  const { data: suggestions = [], isPending: loadingSuggestions } = useQuery<Profile[]>({
    queryKey: ['suggestions', userId, debouncedSearch], // Depends on DEBOUNCED search
    queryFn: async () => {
      if (!userId) return [];
      
      let query = supabase.from('profiles').select('user_id, display_name, avatar_url');
      
      if (debouncedSearch) {
        query = query.ilike('display_name', `%${debouncedSearch}%`);
      }
      
      // Defensive coding: ensure filtering valid IDs
      const idList = Array.from(existingIds).filter(id => id !== undefined && id !== null);
      if (idList.length > 0) {
         // Use proper array syntax for .not to allow Supabase to handle formatting
         query = query.not('user_id', 'in', `(${idList.join(',')})`);
      }
      
      const { data } = await query.limit(20);
      return data || [];
    },
    enabled: activeTab === 'suggestions'
  });

  // --- MUTATIONS WITH OPTIMISTIC UPDATES ---

  const sendFriendRequest = useMutation({
    mutationFn: async (targetProfile: Profile) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from('friendships')
        .insert({ requester_id: userId, addressee_id: targetProfile.user_id, status: 'pending' });
        
      if (error && error.code !== '23505') throw error;
      
      // Trigger notification (fire and forget)
      supabase.from('notifications').insert({
        user_id: targetProfile.user_id,
        type: 'friend_request',
        title: 'New Friend Request',
        content: `You have a new friend request.`,
        data: { requester_id: userId },
      }).then(() => {}); // ignoring promise result

      return targetProfile;
    },
    onMutate: async (targetProfile) => {
      // 1. Cancel queries to avoid overwrite
      await queryClient.cancelQueries({ queryKey: ['friendRequests', 'outgoing'] });
      
      // 2. Update local state for button disabling
      setOptimisticPendingIds(prev => new Set(prev).add(targetProfile.user_id));
      
      // 3. Optimistically update the outgoing requests list
      const previousOutgoing = queryClient.getQueryData<Friendship[]>(['friendRequests', 'outgoing', userId]);
      
      queryClient.setQueryData(['friendRequests', 'outgoing', userId], (old: Friendship[] = []) => [
        ...old,
        {
            id: 'temp-' + Date.now(),
            requester_id: userId!,
            addressee_id: targetProfile.user_id,
            status: 'pending',
            created_at: new Date().toISOString(),
            requester: { user_id: userId! },
            addressee: targetProfile
        } as Friendship
      ]);

      return { previousOutgoing };
    },
    onError: (err, targetProfile, context) => {
      toast.error("Failed to send request");
      setOptimisticPendingIds(prev => {
        const next = new Set(prev);
        next.delete(targetProfile.user_id);
        return next;
      });
      if (context?.previousOutgoing) {
        queryClient.setQueryData(['friendRequests', 'outgoing', userId], context.previousOutgoing);
      }
    },
    onSuccess: () => {
      toast.success('Request sent');
      // Invalidate to get the real ID from server
      queryClient.invalidateQueries({ queryKey: ['friendRequests', 'outgoing'] });
    }
  });

  const acceptFriendRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['friendRequests', 'incoming'] });
      await queryClient.cancelQueries({ queryKey: ['friends'] });

      const previousIncoming = queryClient.getQueryData(['friendRequests', 'incoming', userId]);
      
      // Remove from incoming immediately
      queryClient.setQueryData(['friendRequests', 'incoming', userId], (old: Friendship[] = []) => 
        old.filter(r => r.id !== id)
      );

      // We don't optimistically add to "Friends" list because we need the full profile data joined,
      // which we might not have fully handy here. We just hide the request.
      return { previousIncoming };
    },
    onError: (err, id, context) => {
      toast.error("Failed to accept");
      if (context?.previousIncoming) {
        queryClient.setQueryData(['friendRequests', 'incoming', userId], context.previousIncoming);
      }
    },
    onSuccess: () => {
      toast.success('Friend added!');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    }
  });

  const rejectFriendRequest = useMutation({
    mutationFn: async (id: string) => await supabase.from('friendships').delete().eq('id', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['friendRequests', 'incoming'] });
      const previousIncoming = queryClient.getQueryData(['friendRequests', 'incoming', userId]);
      queryClient.setQueryData(['friendRequests', 'incoming', userId], (old: Friendship[] = []) => 
        old.filter(r => r.id !== id)
      );
      return { previousIncoming };
    },
    onError: (err, id, context) => {
       if (context?.previousIncoming) {
        queryClient.setQueryData(['friendRequests', 'incoming', userId], context.previousIncoming);
      }
    },
    onSuccess: () => toast.info('Request removed')
  });

  const cancelSentRequest = useMutation({
    mutationFn: async (id: string) => await supabase.from('friendships').delete().eq('id', id),
    onSuccess: () => {
      toast.info('Request cancelled');
      queryClient.invalidateQueries({ queryKey: ['friendRequests', 'outgoing'] });
      // Note: We rely on invalidate to clear the 'optimisticPendingIds' implicitly via existingIds recalc
    }
  });

  // --- RENDER HELPERS ---
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

        {/* 1. ALL FRIENDS */}
        <TabsContent value="all" className="mt-4 space-y-2">
          <Card className="border-0 shadow-none bg-transparent"><CardContent className="p-0">
            {loadingFriends ? <FriendSkeleton /> : filteredFriends.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {debouncedSearch ? "No friends found matching search." : "No friends yet."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map(f => {
                  const p = f.requester_id === userId ? f.addressee : f.requester;
                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40 hover:bg-accent/5 cursor-pointer transition-colors" onClick={() => navigate(`/messages?userId=${p.user_id}`)}>
                      {renderProfile(p, "Connected")}
                      <Button variant="ghost" size="icon"><MessageSquare className="w-5 h-5 text-primary" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* 2. REQUESTS */}
        <TabsContent value="requests" className="mt-4">
          <div className="flex gap-2 mb-4 p-1 bg-muted/20 rounded-lg w-fit mx-auto">
            <button 
                onClick={() => setRequestView('received')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${requestView === 'received' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
                Received {incomingRequests.length > 0 && `(${incomingRequests.length})`}
            </button>
            <button 
                onClick={() => setRequestView('sent')}
                className={`px-4 py-1.5 text-sm rounded-md transition-all ${requestView === 'sent' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
                Sent {outgoingRequests.length > 0 && `(${outgoingRequests.length})`}
            </button>
          </div>

          {requestView === 'received' && (
            <>
                {loadingIncoming ? <FriendSkeleton /> : incomingRequests.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No incoming requests.</div>
                ) : (
                    <div className="space-y-2">
                    {incomingRequests.map(r => (
                        <div key={r.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                        {renderProfile(r.requester, "Wants to connect")}
                        <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => rejectFriendRequest.mutate(r.id)}><X className="w-5 h-5" /></Button>
                            <Button size="icon" className="gradient-primary text-white rounded-full" onClick={() => acceptFriendRequest.mutate(r.id)}><Check className="w-5 h-5" /></Button>
                        </div>
                        </div>
                    ))}
                    </div>
                )}
            </>
          )}

          {requestView === 'sent' && (
            <>
                {loadingOutgoing ? <FriendSkeleton /> : outgoingRequests.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No sent requests pending.</div>
                ) : (
                    <div className="space-y-2">
                    {outgoingRequests.map(r => (
                        <div key={r.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40 opacity-80">
                        {renderProfile(r.addressee, "Request sent")}
                        <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => cancelSentRequest.mutate(r.id)}>
                             Cancel
                        </Button>
                        </div>
                    ))}
                    </div>
                )}
            </>
          )}
        </TabsContent>

        {/* 3. MUTUALS */}
        <TabsContent value="mutual" className="mt-4">
          {loadingMutuals ? <FriendSkeleton /> : mutuals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                {friends.length === 0 ? "Add friends to see mutual connections." : "No mutual connections found."}
            </div>
          ) : (
            <div className="space-y-2">
              {mutuals.map((p: Profile) => {
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
              })}
            </div>
          )}
        </TabsContent>

        {/* 4. SUGGESTIONS */}
        <TabsContent value="suggestions" className="mt-4">
           {loadingSuggestions ? <FriendSkeleton /> : suggestions.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">No new suggestions found.</div>
           ) : (
             <div className="space-y-2">
               {suggestions.map(p => {
                 const isSent = existingIds.has(p.user_id);
                 return (
                   <div key={p.user_id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                     {renderProfile(p, "Suggested for you")}
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
               })}
             </div>
           )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
