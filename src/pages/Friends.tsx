import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, MessageSquare, UserPlus, Check, X, Filter, ArrowUpDown, Users, Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- TYPES ---
type Profile = {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  mutual_count?: number; // Added for Mutuals logic
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

export default function Friends() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // State
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [activeTab, setActiveTab] = useState("all");

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
  });

  // 2. Fetch PENDING requests
  const { data: requests = [], isPending: loadingRequests } = useQuery<Friendship[]>({
    queryKey: ['friendRequests', userId],
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

  // 3. MUTUALS QUERY (The New Feature)
  const { data: mutuals = [], isPending: loadingMutuals } = useQuery({
    queryKey: ['mutuals', userId],
    queryFn: async () => {
      if (!userId) return [];
      // Try RPC first
      try {
        const { data, error } = await supabase.rpc('get_mutual_suggestions', { current_user_id: userId });
        if (!error && data) {
          // Fetch details for these users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', data.map((d: any) => d.user_id));
            
          return profiles?.map(p => ({
            ...p,
            mutual_count: data.find((d: any) => d.user_id === p.user_id)?.mutual_count || 0
          })) || [];
        }
      } catch (e) {
        console.warn("RPC failed, falling back or empty", e);
      }
      return [];
    },
    enabled: activeTab === 'mutual'
  });

  // 4. Suggestions
  const existingIds = useMemo(() => {
    const fIds = friends.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
    const rIds = requests.map(r => r.requester_id);
    return new Set([...fIds, ...rIds, userId]);
  }, [friends, requests, userId]);

  const { data: suggestions = [], isPending: loadingSuggestions } = useQuery<Profile[]>({
    queryKey: ['suggestions', userId, search],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase.from('profiles').select('user_id, display_name, avatar_url');
      if (search) query = query.ilike('display_name', `%${search}%`);
      
      // Filter existing
      if (existingIds.size > 0) {
        query = query.not('user_id', 'in', `(${Array.from(existingIds).map(id => `"${id}"`).join(',')})`);
      }
      
      const { data } = await query.limit(20);
      return data || [];
    },
    enabled: activeTab === 'suggestions'
  });

  // --- MUTATIONS ---
  const sendFriendRequest = useMutation({
    mutationFn: async (targetId: string) => {
      if (!userId) return;
      await supabase.from('friendships').insert({ requester_id: userId, addressee_id: targetId, status: 'pending' });
    },
    onSuccess: () => {
      toast.success('Request sent!');
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['mutuals'] });
    }
  });

  const acceptFriendRequest = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', id);
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

  // Helper Renderer
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

  // Filter Friends List
  const filteredFriends = useMemo(() => {
    let res = [...friends];
    if (search) res = res.filter(f => (f.requester_id === userId ? f.addressee : f.requester).display_name?.toLowerCase().includes(search.toLowerCase()));
    res.sort((a, b) => {
       const pA = a.requester_id === userId ? a.addressee : a.requester;
       const pB = b.requester_id === userId ? b.addressee : b.requester;
       return sortOption === 'alphabetical' 
        ? (pA.display_name || '').localeCompare(pB.display_name || '') 
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return res;
  }, [friends, search, sortOption, userId]);

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
            {requests.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="mutual">Mutuals</TabsTrigger>
          <TabsTrigger value="suggestions">Add</TabsTrigger>
        </TabsList>

        {/* 1. ALL FRIENDS */}
        <TabsContent value="all" className="mt-4 space-y-2">
          <Card className="border-0 shadow-none bg-transparent"><CardContent className="p-0">
            {loadingFriends ? <FriendSkeleton /> : filteredFriends.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No friends found.</div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map(f => {
                  const p = f.requester_id === userId ? f.addressee : f.requester;
                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40 hover:bg-accent/5 cursor-pointer" onClick={() => navigate(`/messages?userId=${p.user_id}`)}>
                      {renderProfile(p, "Friends")}
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
          {loadingRequests ? <FriendSkeleton /> : requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No pending requests.</div>
          ) : (
            <div className="space-y-2">
              {requests.map(r => (
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
        </TabsContent>

        {/* 3. MUTUALS (New) */}
        <TabsContent value="mutual" className="mt-4">
          {loadingMutuals ? <FriendSkeleton /> : mutuals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No mutual connections found.</div>
          ) : (
            <div className="space-y-2">
              {mutuals.map((p: any) => (
                <div key={p.user_id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                  {renderProfile(p, `${p.mutual_count} mutual friends`)}
                  <Button size="sm" variant="secondary" onClick={() => sendFriendRequest.mutate(p.user_id)}>
                    <UserPlus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 4. SUGGESTIONS */}
        <TabsContent value="suggestions" className="mt-4">
           {loadingSuggestions ? <FriendSkeleton /> : suggestions.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">No new suggestions.</div>
           ) : (
             <div className="space-y-2">
               {suggestions.map(p => (
                 <div key={p.user_id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                   {renderProfile(p, "Suggested for you")}
                   <Button size="sm" className="gradient-primary text-white" onClick={() => sendFriendRequest.mutate(p.user_id)}>
                     <UserPlus className="w-4 h-4 mr-1" /> Add
                   </Button>
                 </div>
               ))}
             </div>
           )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
    
