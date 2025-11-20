import React, { useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Send, Phone, Video, ArrowLeft, Plus, 
  Image as ImageIcon, Settings, MoreVertical, Users, MessageSquare
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Types ---
type ChatMode = 'dm' | 'community';
type SelectedChat = 
  | { type: 'dm'; id: string; partner_id: string; name: string; avatar?: string; }
  | { type: 'community'; id: string; name: string; avatar?: string; description?: string; creator_id: string; member_count: number; };

// --- Components ---
const ChatSkeleton = () => (
  <div className="space-y-4 pt-2">
    {[1,2,3].map(i => (
      <div key={i} className="flex items-center gap-3 px-2">
        <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="w-1/3 h-4 bg-muted animate-pulse rounded" />
          <div className="w-2/3 h-3 bg-muted/50 animate-pulse rounded" />
        </div>
      </div>
    ))}
  </div>
);

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

  const { data: commList = [], isLoading: loadingComms } = useQuery({
    queryKey: ['comm_list'],
    queryFn: async () => {
      const { data } = await supabase.from('communities').select('*');
      return data?.map((c: any) => ({
        type: 'community',
        id: c.id,
        name: c.name,
        description: c.description,
        avatar: c.avatar_url,
        creator_id: c.creator_id,
        member_count: c.member_count
      })) || [];
    }
  });

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

  // --- Messages Query ---
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

  // --- Handlers ---
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

  const createCommunity = useMutation({
  mutationFn: async () => {
    if (!user) return;
    
    const { data, error } = await supabase.from('communities').insert({ 
      name: newCommName, 
      description: newCommDesc, 
      creator_id: user.id, 
      member_count: 1 
    })
    .select() // <--- Important: Asks Supabase to return the created row
    .single();

    if (error) throw error; // <--- This triggers the onError block
    return data;
  },
  onSuccess: () => {
    setIsCreateCommunityOpen(false);
    setNewCommName(''); // Clear the form
    setNewCommDesc('');
    queryClient.invalidateQueries({ queryKey: ['comm_list'] });
    toast.success("Community created");
  },
  onError: (error) => {
    toast.error(`Failed to create: ${error.message}`); // Now you will see WHY it failed
  }
});
  
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  // --- Render: Chat View ---
  if (selectedChat) {
    const isComm = selectedChat.type === 'community';
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
            <p className="text-xs text-muted-foreground">{isComm ? 'Community' : 'Active now'}</p>
          </div>
          {isComm && (selectedChat as any).creator_id === user?.id && (
             <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}><Settings className="h-5 w-5" /></Button>
          )}
        </div>

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
          <Textarea 
            value={messageInput} 
            onChange={(e) => setMessageInput(e.target.value)} 
            placeholder="Message..." 
            className="min-h-[44px] max-h-32 py-3 resize-none rounded-2xl bg-muted border-0 focus-visible:ring-0"
          />
          <Button size="icon" onClick={() => sendMessage.mutate()} className="rounded-full h-11 w-11">
            <Send className="h-5 w-5" />
          </Button>
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
          {loadingDMs ? <ChatSkeleton /> : dmList.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
               <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4"><MessageSquare className="w-8 h-8 text-muted-foreground" /></div>
               <p>No messages yet.</p>
               <Button variant="link" onClick={() => setIsNewChatOpen(true)}>Start a chat</Button>
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
          {loadingComms ? <ChatSkeleton /> : commList.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
               <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-muted-foreground" /></div>
               <p>No communities joined.</p>
               <Button variant="link" onClick={() => setIsCreateCommunityOpen(true)}>Create one</Button>
             </div>
          ) : (
             commList.filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((comm: any) => (
               <div key={comm.id} onClick={() => setSelectedChat(comm)} className="flex items-center gap-3 p-3 hover:bg-accent/50 rounded-xl cursor-pointer transition-colors">
                 <Avatar className="h-12 w-12 rounded-xl border border-border/50"><AvatarImage src={comm.avatar} /><AvatarFallback className="rounded-xl">{comm.name[0]}</AvatarFallback></Avatar>
                 <div className="flex-1 min-w-0">
                   <h3 className="font-semibold truncate">{comm.name}</h3>
                   <p className="text-xs text-muted-foreground">{comm.member_count} members</p>
                 </div>
               </div>
             ))
          )}
        </TabsContent>
      </Tabs>

      {/* NEW DM MODAL */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
          <Input placeholder="Search friends..." className="bg-muted/50" />
          <ScrollArea className="flex-1">
             <div className="space-y-2 p-1">
               {friends.length === 0 && <div className="text-center text-muted-foreground p-8">No friends found.<br/><Button variant="link" size="sm">Invite friends</Button></div>}
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
    
