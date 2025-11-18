import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, 
  MessageSquare, 
  UserPlus, 
  Check, 
  X, 
  Filter, 
  ArrowUpDown 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- TYPES ---
type Profile = {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string; // Added for sorting
  requester: Profile;
  addressee: Profile;
};

type SortOption = 'newest' | 'alphabetical';

export default function Friends() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  
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
          id, 
          requester_id, 
          addressee_id, 
          status,
          created_at, 
          requester:profiles!requester_id (user_id, display_name, avatar_url), 
          addressee:profiles!addressee_id (user_id, display_name, avatar_url)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted');
      
      if (error) {
        console.error("Error fetching friends:", error);
        toast.error('Failed to load friends');
        throw error;
      }
      return data || [];
    },
    enabled: !!userId,
  });

  // 2. Fetch PENDING friend requests
  const { data: requests = [], isPending: loadingRequests } = useQuery<Friendship[]>({
    queryKey: ['friendRequests', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, 
          requester_id, 
          addressee_id, 
          status,
          created_at, 
          requester:profiles!requester_id (user_id, display_name, avatar_url), 
          addressee:profiles!addressee_id (user_id, display_name, avatar_url)
        `)
        .eq('addressee_id', userId)
        .eq('status', 'pending');
        
      if (error) {
        console.error("Error fetching requests:", error);
        toast.error('Failed to load friend requests');
        throw error;
      }
      return data || [];
    },
    enabled: !!userId,
  });

  // 3. Calculate existing connections to exclude from suggestions
  const existingFriendIds = useMemo(() => {
    const friendIds = friends.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
    const requestIds = requests.map(r => r.requester_id);
    // Also fetch requests sent BY me (pending) to avoid showing them in suggestions
    // Note: Ideally we'd fetch 'sent_requests' too, but for now this covers incoming
    return new Set([...friendIds, ...requestIds, userId]);
  }, [friends, requests, userId]);

  // 4. Fetch SUGGESTIONS (Now supports Search!)
  const { data: suggestions = [], isPending: loadingSuggestions } = useQuery<Profile[]>({
    queryKey: ['suggestions', userId, Array.from(existingFriendIds), search],
    queryFn: async () => {
      if (!userId) return [];
      
      let query = supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url');

      // If searching in suggestions tab, filter by name
      if (search.length > 0 && activeTab === 'suggestions') {
        query = query.ilike('display_name', `%${search}%`);
      }

      // Exclude existing friends
      // Production Note: If friend list is massive (>1000), this filter strategy might need pagination 
      // or an Edge Function, but for direct queries this is the standard way.
      if (existingFriendIds.size > 0) {
        const idsToExclude = Array.from(existingFriendIds).map(id => `"${id}"`).join(',');
        query = query.not('user_id', 'in', `(${idsToExclude})`);
      }

      const { data, error } = await query.limit(20);
        
      if (error) {
        console.error("Error fetching suggestions:", error);
        toast.error('Failed to load suggestions');
        throw error;
      }
      return data || [];
    },
    enabled: !!userId,
  });

  // --- MUTATIONS ---

  const sendFriendRequest = useMutation({
    mutationFn: async (targetId: string) => {
      if (!userId) throw new Error('No user logged in');
      const { data, error } = await supabase
        .from('friendships')
        .insert({ requester_id: userId, addressee_id: targetId, status: 'pending' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Friend request sent!');
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
    onError: (error) => {
      toast.error('Failed to send request');
      console.error(error);
    }
  });

  const acceptFriendRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data, error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('You are now friends!');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: () => {
      toast.error('Failed to accept request');
    }
  });

  const rejectFriendRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data, error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.info('Request ignored');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: () => {
      toast.error('Failed to reject request');
    }
  });

  // --- HELPERS ---

  const renderProfile = (profile: Profile) => (
    <>
      <Avatar className="w-12 h-12 border border-border/50">
        <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
        <AvatarFallback className="bg-muted text-muted-foreground">
          {profile.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0"> {/* min-w-0 ensures truncation works */}
        <div className="font-semibold truncate">{profile.display_name || 'Unknown User'}</div>
      </div>
    </>
  );

  // Filter and Sort Logic for "My Friends" Tab
  const filteredFriends = useMemo(() => {
    let result = [...friends];

    // 1. Filter by Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(f => {
        const profile = f.requester_id === userId ? f.addressee : f.requester;
        return profile.display_name?.toLowerCase().includes(lowerSearch);
      });
    }

    // 2. Sort
    result.sort((a, b) => {
      const pA = a.requester_id === userId ? a.addressee : a.requester;
      const pB = b.requester_id === userId ? b.addressee : b.requester;

      if (sortOption === 'alphabetical') {
        return (pA.display_name || '').localeCompare(pB.display_name || '');
      }
      // Default: Newest (Created At desc)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [friends, search, sortOption, userId]);

  return (
    <div className="container-mobile py-4 space-y-4 min-h-[80vh]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        {/* Optional: Add friend generic button if needed later */}
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder={activeTab === 'suggestions' ? "Find new people..." : "Search your friends..."}
            className="pl-10 bg-background/50 backdrop-blur-sm"
          />
        </div>
        
        {/* Advanced Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOption('newest')}>
              <ArrowUpDown className="mr-2 h-4 w-4" /> Newest First
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption('alphabetical')}>
              <Filter className="mr-2 h-4 w-4" /> A-Z
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 p-1">
          <TabsTrigger value="all">My Friends</TabsTrigger>
          <TabsTrigger value="requests" className="relative">
            Requests
            {requests.length > 0 && (
              <Badge className="ml-1.5 h-5 px-1.5 min-w-[1.25rem] bg-primary text-primary-foreground text-[10px] flex items-center justify-center rounded-full absolute -top-1 -right-1 md:static md:top-auto md:right-auto">
                {requests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="suggestions">Discover</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 animate-in fade-in-50">
          <Card className="gradient-card shadow-card border-0 overflow-hidden">
            <CardContent className="p-0">
              {loadingFriends ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : filteredFriends.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
                   <p className="text-muted-foreground">
                    {search ? "No friends found matching your search." : "You haven't added any friends yet."}
                   </p>
                   {!search && (
                     <Button variant="link" onClick={() => setActiveTab("suggestions")}>
                       Find people to add
                     </Button>
                   )}
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filteredFriends.map((f) => {
                    const friendProfile = f.requester_id === userId ? f.addressee : f.requester;
                    return (
                      <li key={f.id} className="flex items-center gap-3 p-4 hover:bg-accent/5 transition-colors">
                        {renderProfile(friendProfile)}
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                          <MessageSquare size={18} />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4 animate-in fade-in-50">
          <Card className="gradient-card shadow-card border-0 overflow-hidden">
            <CardContent className="p-0">
              {loadingRequests ? (
                <div className="p-8 text-center text-muted-foreground">Checking requests...</div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No pending requests.</div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {requests.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 p-4 hover:bg-accent/5 transition-colors">
                      {renderProfile(r.requester)}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                          onClick={() => rejectFriendRequest.mutate(r.id)}
                          disabled={rejectFriendRequest.isPending}
                        >
                          <X size={14} />
                        </Button>
                        <Button 
                          size="icon" 
                          className="w-8 h-8 gradient-primary text-white shadow-sm"
                          onClick={() => acceptFriendRequest.mutate(r.id)}
                          disabled={acceptFriendRequest.isPending}
                        >
                          <Check size={14} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4 animate-in fade-in-50">
          <Card className="gradient-card shadow-card border-0 overflow-hidden">
            <CardContent className="p-0">
              {loadingSuggestions ? (
                <div className="p-8 text-center text-muted-foreground">Finding people...</div>
              ) : suggestions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                   {search ? "No users found." : "No suggestions right now."}
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {suggestions.map((p) => (
                    <li key={p.user_id} className="flex items-center gap-3 p-4 hover:bg-accent/5 transition-colors">
                      {renderProfile(p)}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        onClick={() => sendFriendRequest.mutate(p.user_id)}
                        disabled={sendFriendRequest.isPending}
                      >
                        <UserPlus size={16} />
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
  }
