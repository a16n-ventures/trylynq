// Friends.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useInfiniteQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { Avatar, Button, Input, Card, CardContent } from "@/components/ui"; // adapt if different exports
import { Search, MessageSquare, UserPlus, Users } from "lucide-react";
import { FixedSizeList as VirtualList, ListChildComponentProps } from "react-window";

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
  updated_at?: string;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "accepted" | "pending" | "rejected";
  created_at: string;
  requester?: Profile;
  addressee?: Profile;
};

// Query client used only when this component is rendered standalone
const queryClient = new QueryClient();

async function sendFriendRequestRPC(targetId: string, myId: string) {
  // Prefer an edge function endpoint over RPC if available
  try {
    const res = await fetch('/api/edge/send-friend-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_id: myId, addressee_id: targetId }),
    });
    if (!res.ok) {
      // fallback to rpc or insert
      throw new Error('Edge request failed');
    }
    return await res.json();
  } catch (err) {
    // fallback to guarded insert using Supabase client
    const { data, error } = await supabase
      .from<FriendshipRow>('friendships')
      .insert({ requester_id: myId, addressee_id: targetId, status: 'pending' })
      .select();
    if (error) throw error;
    return data;
  }
}

export default function Friends() {
  // Get authenticated user - use getUser() to ensure we have the up-to-date user
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUserId(data?.user?.id ?? null);
      } catch (e) {
        console.error('Failed to get user', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [activeTab, setActiveTab] = useState<'all'|'requests'|'nearby'|'suggestions'>('all');
  const [search, setSearch] = useState('');
  const [openChatWith, setOpenChatWith] = useState<Profile | null>(null);
  const channelRef = useRef<any>(null);

  // --- accepted friends (infinite) ---
  const PAGE_SIZE = 20;
  const acceptedFriendsQuery = useInfiniteQuery(
    ['friends', 'accepted', userId, search],
    async ({ pageParam }) => {
      // pageParam is offset for simplicity
      const offset = typeof pageParam === 'number' ? pageParam : 0;
      const builder = supabase
        .from('friendships')
        .select(`id, requester_id, addressee_id, status, created_at, requester:profiles!requester_id(id,full_name,avatar_url,updated_at), addressee:profiles!addressee_id(id,full_name,avatar_url,updated_at)`)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
        .offset(offset);

      const { data, error } = await builder;
      if (error) throw error;
      const rows = (data || []) as FriendshipRow[];
      const profiles = rows.map(row => {
        const friendProfile = row.requester_id === userId ? row.addressee : row.requester;
        return {
          id: friendProfile?.id,
          full_name: friendProfile?.full_name,
          avatar_url: friendProfile?.avatar_url,
          updated_at: friendProfile?.updated_at,
        } as Profile;
      });
      return { profiles, nextOffset: profiles.length === PAGE_SIZE ? offset + PAGE_SIZE : null };
    },
    {
      enabled: !!userId,
      getNextPageParam: last => last.nextOffset,
      staleTime: 1000 * 60 * 2,
    }
  );

  const acceptedProfiles = useMemo(() => {
    const pages = acceptedFriendsQuery.data?.pages ?? [];
    return pages.flatMap(p => p.profiles) as Profile[];
  }, [acceptedFriendsQuery.data]);

  // --- pending requests ---
  const pendingQuery = useQuery(
    ['friends', 'pending', userId],
    async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select(`id, requester:profiles!requester_id(id,full_name,avatar_url), addressee:profiles!addressee_id(id,full_name,avatar_url), created_at`)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    { enabled: !!userId, staleTime: 1000 * 30 }
  );

  // --- nearby profiles (placeholder) ---
  const nearbyQuery = useQuery(['profiles','nearby', userId], async () => {
    const { data, error } = await supabase
      .from<Profile>('profiles')
      .select('id, full_name, avatar_url, updated_at')
      .neq('id', userId)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  }, { enabled: !!userId });

  // --- recommendations via edge function ---
  const recommendationsQuery = useQuery(['ai-recs', userId], async () => {
    const edgeUrl = process.env.NEXT_PUBLIC_RECOMMEND_EDGE || '/api/recommend-friends';
    const res = await fetch(edgeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, limit: 12 }) });
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return res.json();
  }, { enabled: !!userId, staleTime: 1000 * 60 * 2 });

  // --- mutations ---
  const sendRequestMutation = useMutation((targetId: string) => sendFriendRequestRPC(targetId, userId as string), {
    onSuccess: () => queryClient.invalidateQueries(['friends']),
    onError: (err) => console.error('send request failed', err),
  });

  const acceptMutation = useMutation(async (requestId: string) => {
    const { data, error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId).select();
    if (error) throw error;
    return data;
  }, { onSuccess: () => queryClient.invalidateQueries(['friends']) });

  const rejectMutation = useMutation(async (requestId: string) => {
    const { data, error } = await supabase.from('friendships').update({ status: 'rejected' }).eq('id', requestId).select();
    if (error) throw error;
    return data;
  }, { onSuccess: () => queryClient.invalidateQueries(['friends']) });

  // --- realtime subscription (subscribe to table and filter client-side) ---
  useEffect(() => {
    if (!userId) return;
    // cleanup previous
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel('public:friendships')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => {
        const newRow = payload.new as FriendshipRow | null;
        const oldRow = payload.old as FriendshipRow | null;
        const touchesUser = [newRow, oldRow].some(r => !!r && (r.requester_id === userId || r.addressee_id === userId));
        if (touchesUser) {
          queryClient.invalidateQueries(['friends']);
          queryClient.invalidateQueries(['ai-recs']);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [userId]);

  // --- helper to fetch mutual friends via RPC ---
  const fetchMutualFriends = useCallback(async (otherId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_mutual_friends', { a: userId, b: otherId });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Failed to fetch mutuals', e);
      return [];
    }
  }, [userId]);

  // --- react-window row renderer ---
  const FriendRow = ({ index, style }: ListChildComponentProps) => {
    const profile = acceptedProfiles[index];
    if (!profile) return <div style={style} />;
    return (
      <div style={style} className="p-2 flex items-center gap-3">
        <Avatar src={profile.avatar_url || undefined} alt={profile.full_name || ''} />
        <div className="flex-1">
          <div className="font-medium">{profile.full_name || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground">{profile.updated_at}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setOpenChatWith(profile)} title="Message">
            <MessageSquare size={16} />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto p-4">
        <div className="flex items-center gap-4 mb-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search friends..." />
          <Button onClick={() => setSearch('')}>Clear</Button>
        </div>

        <div className="flex gap-3 mb-4">
          <Button variant={activeTab === "all" ? "default" : "ghost"} onClick={() => setActiveTab("all")}>All</Button>
          <Button variant={activeTab === "requests" ? "default" : "ghost"} onClick={() => setActiveTab("requests")}>Requests</Button>
          <Button variant={activeTab === "nearby" ? "default" : "ghost"} onClick={() => setActiveTab("nearby")}>Nearby</Button>
          <Button variant={activeTab === "suggestions" ? "default" : "ghost"} onClick={() => setActiveTab("suggestions")}>Suggestions</Button>
        </div>

        <Card>
          <CardContent>
            {activeTab === "all" && (
              <div>
                {acceptedFriendsQuery.isLoading ? (
                  <div>Loading friends...</div>
                ) : acceptedProfiles.length === 0 ? (
                  <div>No friends yet — try Suggestions.</div>
                ) : (
                  <VirtualList height={400} width="100%" itemSize={72} itemCount={acceptedProfiles.length}>
                    {FriendRow}
                  </VirtualList>
                )}
                {acceptedFriendsQuery.hasNextPage && (
                  <div className="mt-2 text-center">
                    <Button onClick={() => acceptedFriendsQuery.fetchNextPage()}>Load more</Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "requests" && (
              <div>
                {pendingQuery.isLoading ? (
                  <div>Loading requests...</div>
                ) : pendingQuery.data?.length === 0 ? (
                  <div>No pending requests</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pendingQuery.data?.map((r: any) => (
                      <div key={r.id} className="p-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar src={r.requester?.avatar_url} alt={r.requester?.full_name} />
                          <div>
                            <div className="font-medium">{r.requester?.full_name}</div>
                            <div className="text-xs text-muted-foreground">Requested</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => acceptMutation.mutate(r.id)}>Accept</Button>
                          <Button variant="ghost" onClick={() => rejectMutation.mutate(r.id)}>Reject</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "nearby" && (
              <div>
                <div className="mb-2 font-semibold">Nearby</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {nearbyQuery.data?.map((p: Profile) => (
                    <div key={p.id} className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar src={p.avatar_url || undefined} alt={p.full_name} />
                        <div>
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">Nearby user</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => sendRequestMutation.mutate(p.id)} title="Send Request"> <UserPlus size={16} /></Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="mb-2 font-semibold">Mutual Connections</div>
                  <div className="text-sm text-muted-foreground">Click a profile to view mutual friends</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {nearbyQuery.data?.map((p) => (
                      <button
                        key={p.id}
                        className="p-2 border rounded flex items-center justify-between"
                        onClick={async () => {
                          const mutuals = await fetchMutualFriends(p.id);
                          console.log("Mutuals for", p.id, mutuals);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar src={p.avatar_url || undefined} alt={p.full_name} />
                          <div>
                            <div className="font-medium">{p.full_name}</div>
                            <div className="text-xs text-muted-foreground">View mutual friends</div>
                          </div>
                        </div>
                        <Users size={18} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "suggestions" && (
              <div>
                <div className="mb-2 font-semibold">AI-driven Suggestions</div>
                {recommendationsQuery.isLoading ? (
                  <div>Loading suggestions...</div>
                ) : recommendationsQuery.data?.length === 0 ? (
                  <div>No suggestions available right now.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {recommendationsQuery.data?.map((p: Profile) => (
                      <div key={p.id} className="p-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar src={p.avatar_url || undefined} alt={p.full_name} />
                          <div>
                            <div className="font-medium">{p.full_name}</div>
                            <div className="text-xs text-muted-foreground">Recommended for you</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => sendRequestMutation.mutate(p.id)} title="Send Request"><UserPlus size={16} /></Button>
                          <Button variant="ghost" onClick={() => setOpenChatWith(p)} title="Message"><MessageSquare size={16} /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {openChatWith && (
          <div className="fixed bottom-4 right-4 w-96 bg-white shadow-lg rounded">
            <div className="p-2 border-b flex items-center justify-between">
              <div className="font-medium">Chat with {openChatWith.full_name}</div>
              <Button variant="ghost" onClick={() => setOpenChatWith(null)}>Close</Button>
            </div>
            <div className="p-2 h-64 overflow-auto">{/* Message list (realtime) */}</div>
            <div className="p-2 border-t flex gap-2">
              <Input placeholder="Type a message..." />
              <Button>Send</Button>
            </div>
          </div>
        )}
      </div>
    </QueryClientProvider>
  );
}
