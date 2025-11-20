import React, { useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Send, ArrowLeft, Plus, 
  Settings, Users, MessageSquare, Shield, Trash2, LogOut, Crown
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// --- Types ---
type ChatMode = 'dm' | 'community';

interface CommunityMember {
  user_id: string;
  role: 'admin' | 'member';
  profile: { display_name: string; avatar_url: string };
}

type SelectedChat = 
  | { type: 'dm'; id: string; partner_id: string; name: string; avatar?: string; }
  | { 
      type: 'community'; 
      id: string; 
      name: string; 
      avatar?: string; 
      description?: string; 
      my_role: 'admin' | 'member' | 'none'; // Crucial for permission handling
      member_count: number; 
    };

// --- Sub-Component: Management Dialog ---
const ManageCommunityDialog = ({ 
  isOpen, 
  onClose, 
  communityId,
  currentName,
  currentDesc 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  communityId: string,
  currentName: string,
  currentDesc: string
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentName);
  const [desc, setDesc] = useState(currentDesc);

  // Fetch Members
  const { data: members = [] } = useQuery({
    queryKey: ['comm_members', communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_members')
        .select('user_id, role, profile:profiles(display_name, avatar_url)')
        .eq('community_id', communityId);
      if (error) throw error;
      return data as unknown as CommunityMember[];
    },
    enabled: isOpen
  });

  // Update Details Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('communities').update({ name, description: desc }).eq('id', communityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
      toast.success("Updated successfully");
    }
  });

  // Kick Member Mutation
  const kickMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('community_members').delete().match({ community_id: communityId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comm_members', communityId] });
      toast.success("Member removed");
    }
  });

  // Delete Community Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('communities').delete().eq('id', communityId);
      if (error) throw error;
    },
    onSuccess: () => {
      onClose();
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
      toast.success("Community deleted");
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Community</DialogTitle>
          <DialogDescription>Edit details and manage members.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save Changes</Button>
            
            <div className="pt-6 border-t mt-6">
              <h4 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h4>
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()}>Delete Community</Button>
            </div>
          </TabsContent>

          <TabsContent value="members" className="flex-1 overflow-hidden flex flex-col mt-4">
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8"><AvatarImage src={m.profile.avatar_url} /></Avatar>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">{m.profile.display_name}</span>
                          {m.role === 'admin' && <Crown className="w-3 h-3 text-yellow-500" />}
                        </div>
                      </div>
                    </div>
                    {m.role !== 'admin' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-100" onClick={() => kickMutation.mutate(m.user_id)}>
                        <LogOut className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// --- Main Component ---
export default function Messages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  
  // State
  const [activeTab, setActiveTab] = useState<ChatMode>('dm');
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form Data
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');

  // --- Queries ---
  
  // 1. DM List
  const { data: dmList = [], isLoading: loadingDMs } = useQuery({
    queryKey: ['dm_list'],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('messages')
        .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const map = new Map();
      data?.forEach((msg: any) => {
        const partner = msg.sender_id === user.id ? msg.receiver : msg.sender;
        if (!map.has(partner.user_id)) {
          map.set(partner.user_id, {
            type: 'dm',
            id: partner.user_id,
            partner_id: partner.user_id,
            name: partner.display_name,
            avatar: partner.avatar_url,
            last_msg: msg.content,
            time: msg.created_at
          });
        }
      });
      return Array.from(map.values());
    }
  });

  // 2. Community List (With Membership Check)
  const { data: commList = [], isLoading: loadingComms } = useQuery({
    queryKey: ['comm_list'],
    queryFn: async () => {
      // Get communities AND check if I am in them
      const { data, error } = await supabase
        .from('communities')
        .select(`
          *, 
          members:community_members(user_id, role)
        `);
      
      if (error) throw error;

      return data?.map((c: any) => {
        const myMembership = c.members.find((m: any) => m.user_id === user?.id);
        return {
          type: 'community',
          id: c.id,
          name: c.name,
          description: c.description,
          avatar: c.avatar_url,
          member_count: c.member_count,
          my_role: myMembership ? myMembership.role : 'none', // 'admin', 'member', or 'none'
          is_joined: !!myMembership
        };
      }) || [];
    }
  });

  // 3. Friends List
  const { data: friends = [] } = useQuery({
    queryKey: ['my_friends'],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('friendships')
        .select('requester_id, addressee_id, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');
      return data?.map((f: any) => {
        const profile = f.requester_id === user.id ? f.addressee : f.requester;
        return { id: profile.user_id, name: profile.display_name, avatar: profile.avatar_url };
      }) || [];
    },
    enabled: isNewChatOpen
  });

  // 4. Active Chat Messages
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedChat?.type, selectedChat?.id],
    queryFn: async () => {
      if (!user || !selectedChat) return [];
      if (selectedChat.type === 'dm') {
        const { data } = await supabase.from('messages').select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedChat.partner_id}),and(sender_id.eq.${selectedChat.partner_id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });
        return data?.map(m => ({ ...m, is_me: m.sender_id === user.id })) || [];
      } else {
        const { data } = await supabase.from('community_messages').select('*, sender:profiles!sender_id(display_name, avatar_url)')
          .eq('community_id', selectedChat.id).order('created_at', { ascending: true });
        return data?.map((m: any) => ({
          id: m.id, content: m.content, created_at: m.created_at,
          is_me: m.sender_id === user.id, sender_name: m.sender?.display_name, sender_avatar: m.sender?.avatar_url
        })) || [];
      }
    },
    enabled: !!selectedChat,
    refetchInterval: 3000
  });

  // --- Mutations ---
  
  // Join Community
  const joinCommunity = useMutation({
    mutationFn: async (communityId: string) => {
      const { error } = await supabase.from('community_members').insert({
        community_id: communityId,
        user_id: user!.id,
        role: 'member'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Joined community!");
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
    }
  });

  // Create Community (AND Join as Admin)
  const createCommunity = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      // 1. Create the Community
      const { data: comm, error: commError } = await supabase.from('communities').insert({ 
        name: newCommName, 
        description: newCommDesc, 
        creator_id: user.id, 
        member_count: 1 
      })
      .select()
      .single();

      if (commError) throw commError;

      // 2. Add creator as Admin immediately
      const { error: memberError } = await supabase.from('community_members').insert({
        community_id: comm.id,
        user_id: user.id,
        role: 'admin'
      });

      if (memberError) throw memberError;

      return comm;
    },
    onSuccess: () => {
      setIsCreateCommunityOpen(false);
      setNewCommName(''); 
      setNewCommDesc('');
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
      toast.success("Community created");
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
    }
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!messageInput.trim() || !selectedChat || !user) return;
      if (selectedChat.type === 'dm') {
        await supabase.from('messages').insert({ sender_id: user.id, receiver_id: selectedChat.partner_id, content: messageInput });
      } else {
        await supabase.from('community_messages').insert({ community_id: selectedChat.id, sender_id: user.id, content: messageInput });
      }
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    }
  });

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  // --- Render: Chat Interface ---
  if (selectedChat) {
    const isComm = selectedChat.type === 'community';
    
    // Determine if user can type
    const canType = !isComm || (isComm && selectedChat.my_role !== 'none');

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="p-3 border-b flex items-center gap-3 bg-background/95 backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <Avatar>
            <AvatarImage src={selectedChat.avatar} />
            <AvatarFallback>{selectedChat.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold">{selectedChat.name}</h3>
            <p className="text-xs text-muted-foreground">
              {isComm 
                ? (selectedChat.my_role !== 'none' ? 'Member' : 'Preview Mode') 
                : 'Active now'}
            </p>
          </div>
          
          {/* Community Settings Button (Only for Admins) */}
          {isComm && selectedChat.my_role === 'admin' && (
             <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
               <Settings className="h-5 w-5" />
             </Button>
          )}
        </div>

        {/* Management Dialog */}
        {isComm && (
          <ManageCommunityDialog 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            communityId={selectedChat.id}
            currentName={selectedChat.name}
            currentDesc={selectedChat.description || ''}
          />
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5" ref={scrollRef}>
          {messages.map((m: any) => (
            <div key={m.id} className={`flex w-full ${m.is_me ? 'justify-end' : 'justify-start'}`}>
              {!m.is_me && isComm && <Avatar className="w-6 h-6 mr-2 mt-1"><AvatarImage src={m.sender_avatar} /><AvatarFallback>{m.sender_name?.[0]}</AvatarFallback></Avatar>}
              <div className={`max-w-[75%] ${m.is_me ? 'items-end' : 'items-start'} flex flex-col`}>
                {!m.is_me && isComm && <span className="text-[10px] ml-1 mb-0.5 text-muted-foreground">{m.sender_name}</span>}
                <div className={`px-4 py-2 rounded-2xl text-sm ${m.is_me ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-secondary text-secondary-foreground rounded-bl-none'}`}>
                  {m.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t flex items-end gap-2">
          {canType ? (
            <>
              <Textarea 
                value={messageInput} 
                onChange={(e) => setMessageInput(e.target.value)} 
                placeholder="Message..." 
                className="min-h-[44px] max-h-32 py-3 resize-none rounded-2xl bg-muted border-0 focus-visible:ring-0"
              />
              <Button size="icon" onClick={() => sendMessage.mutate()} className="rounded-full h-11 w-11">
                <Send className="h-5 w-5" />
              </Button>
            </>
          ) : (
             <Button className="w-full" onClick={() => joinCommunity.mutate(selectedChat.id)}>
               Join Community to Chat
             </Button>
          )}
        </div>
      </div>
    );
  }

  // --- Render: List View ---
  return (
    <div className="container-mobile py-4 min-h-screen flex flex-col pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Button 
          size="icon" 
          variant="ghost" 
          className="rounded-full bg-muted/50 hover:bg-muted"
          onClick={() => activeTab === 'dm' ? setIsNewChatOpen(true) : setIsCreateCommunityOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChatMode)} className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="dm" className="rounded-lg">Direct</TabsTrigger>
          <TabsTrigger value="community" className="rounded-lg">Communities</TabsTrigger>
        </TabsList>

        <div className="relative mb-4">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
           <Input placeholder="Search..." className="pl-10 bg-muted/30 border-none rounded-xl" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <TabsContent value="dm" className="flex-1 space-y-2 animate-in fade-in-50">
          {/* DM List Logic (Unchanged) */}
          {loadingDMs ? <div className="p-4 text-center">Loading...</div> : dmList.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
               <MessageSquare className="w-8 h-8 mb-4 text-muted-foreground" />
               <p>No messages yet.</p>
             </div>
          ) : (
             dmList.filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((chat: any) => (
               <div key={chat.id} onClick={() => setSelectedChat(chat)} className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-xl cursor-pointer transition-colors">
                 <Avatar className="h-12 w-12 border border-border/50"><AvatarImage src={chat.avatar} /><AvatarFallback>{chat.name[0]}</AvatarFallback></Avatar>
                 <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-baseline"><h3 className="font-semibold truncate">{chat.name}</h3><span className="text-xs text-muted-foreground">{new Date(chat.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                   <p className="text-sm text-muted-foreground truncate">{chat.last_msg}</p>
                 </div>
               </div>
             ))
          )}
        </TabsContent>

        <TabsContent value="community" className="flex-1 space-y-2 animate-in fade-in-50">
          {loadingComms ? <div className="p-4 text-center">Loading...</div> : commList.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
               <Users className="w-8 h-8 mb-4 text-muted-foreground" />
               <p>No communities yet.</p>
               <Button variant="link" onClick={() => setIsCreateCommunityOpen(true)}>Create one</Button>
             </div>
          ) : (
             commList.filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((comm: any) => (
               <div key={comm.id} className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-xl transition-colors">
                 <Avatar className="h-12 w-12 rounded-xl border border-border/50"><AvatarImage src={comm.avatar} /><AvatarFallback className="rounded-xl">{comm.name[0]}</AvatarFallback></Avatar>
                 <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedChat(comm)}>
                   <h3 className="font-semibold truncate">{comm.name}</h3>
                   <p className="text-xs text-muted-foreground">{comm.member_count} members</p>
                 </div>
                 
                 {/* Join / Open Button */}
                 {comm.my_role !== 'none' ? (
                   <Button size="sm" variant="secondary" onClick={() => setSelectedChat(comm)}>Open</Button>
                 ) : (
                   <Button size="sm" onClick={() => joinCommunity.mutate(comm.id)}>Join</Button>
                 )}
               </div>
             ))
          )}
        </TabsContent>
      </Tabs>

      {/* NEW DM MODAL (Unchanged) */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
          <Input placeholder="Search friends..." className="bg-muted/50" />
          <ScrollArea className="flex-1">
             <div className="space-y-2 p-1">
               {friends.map((f: any) => (
                 <div key={f.id} onClick={() => { setSelectedChat({ type: 'dm', id: f.id, partner_id: f.id, name: f.name, avatar: f.avatar }); setIsNewChatOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer">
                   <Avatar><AvatarImage src={f.avatar} /><AvatarFallback>{f.name[0]}</AvatarFallback></Avatar>
                   <span className="font-medium">{f.name}</span>
                 </div>
               ))}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* NEW COMMUNITY MODAL */}
      <Dialog open={isCreateCommunityOpen} onOpenChange={setIsCreateCommunityOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Community</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input value={newCommName} onChange={(e) => setNewCommName(e.target.value)} placeholder="e.g. Crypto Talk" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={newCommDesc} onChange={(e) => setNewCommDesc(e.target.value)} placeholder="What is this group about?" /></div>
          </div>
          <DialogFooter><Button onClick={() => createCommunity.mutate()} disabled={!newCommName.trim()}>Create Community</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
