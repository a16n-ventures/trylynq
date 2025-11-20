import React, { useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Send, ArrowLeft, Plus, Settings, Users, 
  MessageSquare, Paperclip, X, Image as ImageIcon, Loader2, 
  MoreVertical, Phone, Video
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// --- TYPES ---
type ChatMode = 'dm' | 'community';

interface Message {
  id: string;
  content?: string;
  image_url?: string;
  created_at: string;
  sender_id: string;
  is_me: boolean;
  sender_name?: string;
  sender_avatar?: string;
}

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
      my_role: 'admin' | 'member' | 'none'; 
      member_count: number; 
    };

// --- SUB-COMPONENT: Message Bubble ---
// Handles proper grouping, image rendering, and styling
const MessageBubble = ({ msg, prevMsg, isComm }: { msg: Message, prevMsg: Message | null, isComm: boolean }) => {
  // Check if the previous message was from the same sender (to group them)
  const isSequence = prevMsg && prevMsg.sender_id === msg.sender_id;
  
  return (
    <div className={`flex w-full mb-1 ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar: Only show for incoming community messages, and only if not in a sequence */}
      {!msg.is_me && isComm && (
        <div className="w-8 mr-2 flex-shrink-0 flex flex-col justify-end">
          {!isSequence ? (
            <Avatar className="w-8 h-8">
              <AvatarImage src={msg.sender_avatar} />
              <AvatarFallback>{msg.sender_name?.[0]}</AvatarFallback>
            </Avatar>
          ) : <div className="w-8" />}
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${msg.is_me ? 'items-end' : 'items-start'}`}>
        {/* Sender Name (Community only, first msg in sequence) */}
        {!msg.is_me && isComm && !isSequence && (
          <span className="text-[10px] ml-1 mb-1 text-muted-foreground font-medium">
            {msg.sender_name}
          </span>
        )}

        {/* The Bubble */}
        <div 
          className={`
            relative px-4 py-2 shadow-sm text-sm overflow-hidden
            ${msg.is_me 
              ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm' 
              : 'bg-white dark:bg-muted border text-foreground rounded-2xl rounded-tl-sm'
            }
            ${msg.image_url ? 'p-0 bg-transparent border-0 shadow-none' : ''}
          `}
        >
          {/* Image Attachment */}
          {msg.image_url && (
            <img 
              src={msg.image_url} 
              alt="Attachment" 
              className={`max-w-full rounded-xl mb-1 border ${msg.is_me ? 'border-primary/20' : 'border-border'}`} 
              style={{ maxHeight: '200px', objectFit: 'cover' }} 
            />
          )}

          {/* Text Content */}
          {msg.content && <p className={msg.image_url ? (msg.is_me ? "bg-primary text-primary-foreground p-2 rounded-xl mt-1" : "bg-white dark:bg-muted p-2 rounded-xl mt-1 border") : ""}>{msg.content}</p>}
        </div>
        
        {/* Timestamp (Optional: could be hidden and shown on hover) */}
        <span className="text-[9px] text-muted-foreground mt-1 px-1 opacity-70">
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: Management Dialog ---
const ManageCommunityDialog = ({ 
  isOpen, onClose, communityId, currentName, currentDesc 
}: { isOpen: boolean, onClose: () => void, communityId: string, currentName: string, currentDesc: string }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentName);
  const [desc, setDesc] = useState(currentDesc);

  const { data: members = [] } = useQuery({
    queryKey: ['comm_members', communityId],
    queryFn: async () => {
      const { data, error } = await supabase.from('community_members').select('user_id, role, profile:profiles(display_name, avatar_url)').eq('community_id', communityId);
      if (error) throw error;
      return data as unknown as CommunityMember[];
    },
    enabled: isOpen
  });

  const updateMutation = useMutation({
    mutationFn: async () => { await supabase.from('communities').update({ name, description: desc }).eq('id', communityId); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comm_list'] }); toast.success("Updated"); }
  });

  const kickMutation = useMutation({
    mutationFn: async (userId: string) => { await supabase.from('community_members').delete().match({ community_id: communityId, user_id: userId }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comm_members', communityId] }); toast.success("Member removed"); }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Community Settings</DialogTitle></DialogHeader>
        <Tabs defaultValue="general" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="general">Overview</TabsTrigger><TabsTrigger value="members">Members</TabsTrigger></TabsList>
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save Changes</Button>
          </TabsContent>
          <TabsContent value="members" className="flex-1 overflow-hidden flex flex-col mt-4"><ScrollArea className="flex-1"><div className="space-y-2 pr-4">{members.map((m) => (<div key={m.user_id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"><div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarImage src={m.profile.avatar_url} /></Avatar><span>{m.profile.display_name} {m.role === 'admin' && '👑'}</span></div>{m.role !== 'admin' && <Button variant="ghost" size="sm" className="text-red-500" onClick={() => kickMutation.mutate(m.user_id)}>Kick</Button>}</div>))}</div></ScrollArea></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// --- MAIN COMPONENT ---
export default function Messages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // State
  const [activeTab, setActiveTab] = useState<ChatMode>('dm');
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Modals
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');

  // --- QUERIES ---
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
            type: 'dm', id: partner.user_id, partner_id: partner.user_id,
            name: partner.display_name, avatar: partner.avatar_url, last_msg: msg.content || 'Attachment', time: msg.created_at
          });
        }
      });
      return Array.from(map.values());
    }
  });

  const { data: commList = [], isLoading: loadingComms } = useQuery({
    queryKey: ['comm_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('communities').select(`*, members:community_members(user_id, role)`);
      if (error) throw error;
      return data?.map((c: any) => {
        const myMembership = c.members.find((m: any) => m.user_id === user?.id);
        return {
          type: 'community', id: c.id, name: c.name, description: c.description,
          avatar: c.avatar_url, member_count: c.member_count,
          my_role: myMembership ? myMembership.role : 'none',
          is_joined: !!myMembership
        };
      }) || [];
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

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedChat?.type, selectedChat?.id],
    queryFn: async () => {
      if (!user || !selectedChat) return [];
      let data;
      if (selectedChat.type === 'dm') {
        const res = await supabase.from('messages').select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedChat.partner_id}),and(sender_id.eq.${selectedChat.partner_id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });
        data = res.data;
      } else {
        const res = await supabase.from('community_messages').select('*, sender:profiles!sender_id(display_name, avatar_url)')
          .eq('community_id', selectedChat.id).order('created_at', { ascending: true });
        data = res.data?.map((m: any) => ({ ...m, sender_name: m.sender?.display_name, sender_avatar: m.sender?.avatar_url }));
      }
      return data?.map((m: any) => ({ ...m, is_me: m.sender_id === user.id })) as Message[] || [];
    },
    enabled: !!selectedChat,
    refetchInterval: 3000
  });

  // --- MUTATIONS ---
  const joinCommunity = useMutation({
    mutationFn: async (communityId: string) => {
      const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: user!.id, role: 'member' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Joined community!"); queryClient.invalidateQueries({ queryKey: ['comm_list'] }); }
  });

  const createCommunity = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data: comm, error } = await supabase.from('communities').insert({ name: newCommName, description: newCommDesc, creator_id: user.id, member_count: 1 }).select().single();
      if (error) throw error;
      await supabase.from('community_members').insert({ community_id: comm.id, user_id: user.id, role: 'admin' });
      return comm;
    },
    onSuccess: () => { setIsCreateCommunityOpen(false); setNewCommName(''); setNewCommDesc(''); queryClient.invalidateQueries({ queryKey: ['comm_list'] }); toast.success("Community created"); },
    onError: (e) => toast.error(e.message)
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if ((!messageInput.trim() && !imageFile) || !selectedChat || !user) return;
      
      let imageUrl = null;
      
      // 1. Handle Image Upload
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(filePath, imageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        imageUrl = publicUrl;
      }

      // 2. Insert Message
      const payload = { sender_id: user.id, content: messageInput, image_url: imageUrl };
      
      if (selectedChat.type === 'dm') {
        await supabase.from('messages').insert({ ...payload, receiver_id: selectedChat.partner_id });
      } else {
        await supabase.from('community_messages').insert({ ...payload, community_id: selectedChat.id });
      }
    },
    onSuccess: () => {
      setMessageInput('');
      setImageFile(null);
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (e) => toast.error("Failed to send: " + e.message)
  });

  // --- HANDLERS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, imagePreview]);

  // --- RENDER: CHAT VIEW ---
  if (selectedChat) {
    const isComm = selectedChat.type === 'community';
    const canType = !isComm || (isComm && selectedChat.my_role !== 'none');

    return (
      // KEY FIX: h-[100dvh] ensures full viewport height on mobile without scrolling the body
      <div className="fixed inset-0 z-50 bg-background flex flex-col h-[100dvh]">
        
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center gap-3 bg-background/95 backdrop-blur shadow-sm shrink-0 z-10">
          <Button variant="ghost" size="icon" className="-ml-2 rounded-full" onClick={() => setSelectedChat(null)}>
            <ArrowLeft className="h-6 w-6 text-muted-foreground" />
          </Button>
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={selectedChat.avatar} />
            <AvatarFallback>{selectedChat.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{selectedChat.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {isComm ? (
                <>
                  <Users className="w-3 h-3" /> 
                  {selectedChat.member_count} members
                  {selectedChat.my_role === 'admin' && <span className="text-amber-500 ml-1 font-bold">• Admin</span>}
                </>
              ) : (
                <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/> Online</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
             {!isComm && (
               <>
                 <Button variant="ghost" size="icon" className="rounded-full"><Phone className="w-5 h-5 text-muted-foreground" /></Button>
                 <Button variant="ghost" size="icon" className="rounded-full"><Video className="w-5 h-5 text-muted-foreground" /></Button>
               </>
             )}
             {isComm ? (
               selectedChat.my_role === 'admin' ? (
                <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}><Settings className="h-5 w-5" /></Button>
               ) : (
                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
               )
             ) : null}
          </div>
        </div>

{/* Management Dialog */}
        {isComm && <ManageCommunityDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} communityId={selectedChat.id} currentName={selectedChat.name} currentDesc={selectedChat.description || ''} />}

        {/* Messages Area (FLEX-1 IS KEY FOR SCROLLING) */}
        <div className="flex-1 overflow-y-auto bg-muted/10 p-4 scroll-smooth" ref={scrollRef}>
          <div className="flex flex-col justify-end min-h-full pb-2">
             {messages.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                 <MessageSquare className="w-12 h-12 mb-2 text-muted-foreground/50" />
                 <p className="text-sm text-muted-foreground">No messages yet</p>
               </div>
             ) : (
               messages.map((m, i) => (
                 <MessageBubble 
                    key={m.id} 
                    msg={m} 
                    prevMsg={i > 0 ? messages[i-1] : null} 
                    isComm={isComm} 
                 />
               ))
             )}
          </div>
        </div>

        {/* Input Area (Fixed at bottom) */}
        <div className="p-3 border-t bg-background shrink-0 pb-safe">
          {canType ? (
            <div className="flex flex-col gap-3">
              {/* Image Preview */}
              {imagePreview && (
                <div className="relative w-24 h-24 bg-muted rounded-xl overflow-hidden border">
                  <img src={imagePreview} className="w-full h-full object-cover" alt="preview" />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground shrink-0" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                
                <div className="flex-1 relative">
                   <Textarea 
                    value={messageInput} 
                    onChange={(e) => setMessageInput(e.target.value)} 
                    placeholder="Message..." 
                    className="min-h-[44px] max-h-32 py-3 pr-10 resize-none rounded-2xl bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage.mutate(); }
                    }}
                  />
                </div>

                <Button 
                  size="icon" 
                  onClick={() => sendMessage.mutate()} 
                  disabled={sendMessage.isPending || (!messageInput.trim() && !imageFile)}
                  className="rounded-full h-11 w-11 shadow-md shrink-0"
                >
                  {sendMessage.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                </Button>
              </div>
            </div>
          ) : (
             <Button className="w-full rounded-xl shadow-md" onClick={() => joinCommunity.mutate(selectedChat.id)}>
               Join Community to Chat
             </Button>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER: LIST VIEW ---
  return (
    <div className="container-mobile pt-6 min-h-screen flex flex-col pb-20 bg-background">
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chats</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Connect with your circle</p>
        </div>
        <Button size="icon" className="rounded-full shadow-lg bg-primary hover:bg-primary/90 h-10 w-10" onClick={() => activeTab === 'dm' ? setIsNewChatOpen(true) : setIsCreateCommunityOpen(true)}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChatMode)} className="w-full flex-1 flex flex-col">
        <div className="px-1 mb-4">
          <div className="bg-muted/50 p-1 rounded-xl flex">
             <TabsTrigger value="dm" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Private</TabsTrigger>
             <TabsTrigger value="community" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Communities</TabsTrigger>
          </div>
          <div className="relative mt-4">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input placeholder="Search conversation..." className="pl-10 bg-muted/30 border-transparent rounded-xl focus:bg-background focus:border-primary/20 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <TabsContent value="dm" className="flex-1 space-y-2 animate-in fade-in-50 px-1">
          {loadingDMs ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading chats...</div> : dmList.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
               <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4"><MessageSquare className="w-8 h-8 text-muted-foreground" /></div>
               <p>No messages yet.</p>
               <Button variant="link" onClick={() => setIsNewChatOpen(true)}>Start a chat</Button>
             </div>
          ) : (
             dmList.filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((chat: any) => (
               <div key={chat.id} onClick={() => setSelectedChat(chat)} className="group flex items-center gap-4 p-3 hover:bg-muted/50 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-border/50">
                 <div className="relative">
                   <Avatar className="h-14 w-14 border-2 border-background shadow-sm"><AvatarImage src={chat.avatar} /><AvatarFallback>{chat.name[0]}</AvatarFallback></Avatar>
                   <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"></span>
                 </div>
                 <div className="flex-1 min-w-0 space-y-1">
                   <div className="flex justify-between items-center"><h3 className="font-bold text-base truncate">{chat.name}</h3><span className="text-[11px] text-muted-foreground font-medium">{new Date(chat.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                   <p className="text-sm text-muted-foreground truncate font-medium opacity-80">{chat.last_msg}</p>
                 </div>
               </div>
             ))
          )}
        </TabsContent>

        <TabsContent value="community" className="flex-1 space-y-2 animate-in fade-in-50 px-1">
          {loadingComms ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading communities...</div> : commList.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
               <Users className="w-12 h-12 mb-4 text-muted-foreground" />
               <p>No communities yet.</p>
               <Button variant="link" onClick={() => setIsCreateCommunityOpen(true)}>Create one</Button>
             </div>
          ) : (
             commList.filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((comm: any) => (
               <div key={comm.id} className="flex items-center gap-4 p-3 hover:bg-muted/50 rounded-2xl transition-all border border-transparent hover:border-border/50">
                 <Avatar className="h-14 w-14 rounded-2xl border shadow-sm"><AvatarImage src={comm.avatar} /><AvatarFallback className="rounded-2xl bg-primary/10 text-primary">{comm.name[0]}</AvatarFallback></Avatar>
                 <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedChat(comm)}>
                   <h3 className="font-bold text-base truncate">{comm.name}</h3>
                   <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Users className="w-3 h-3"/> {comm.member_count} members</p>
                 </div>
                 <Button size="sm" variant={comm.my_role !== 'none' ? "ghost" : "default"} className={comm.my_role !== 'none' ? "text-muted-foreground" : "rounded-full px-6 shadow-md"} onClick={comm.my_role !== 'none' ? () => setSelectedChat(comm) : () => joinCommunity.mutate(comm.id)}>
                   {comm.my_role !== 'none' ? 'Open' : 'Join'}
                 </Button>
               </div>
             ))
          )}
        </TabsContent>
      </Tabs>

      {/* DIALOGS (Simplified for brevity, kept functional) */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="h-[80vh] flex flex-col"><DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader><Input placeholder="Search friends..." className="bg-muted/50" /><ScrollArea className="flex-1"><div className="space-y-2 p-1">{friends.map((f: any) => (<div key={f.id} onClick={() => { setSelectedChat({ type: 'dm', id: f.id, partner_id: f.id, name: f.name, avatar: f.avatar }); setIsNewChatOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer"><Avatar><AvatarImage src={f.avatar} /><AvatarFallback>{f.name[0]}</AvatarFallback></Avatar><span className="font-medium">{f.name}</span></div>))}</div></ScrollArea></DialogContent>
      </Dialog>

      <Dialog open={isCreateCommunityOpen} onOpenChange={setIsCreateCommunityOpen}>
        <DialogContent><DialogHeader><DialogTitle>Create Community</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label>Name</Label><Input value={newCommName} onChange={(e) => setNewCommName(e.target.value)} placeholder="e.g. Crypto Talk" /></div><div className="space-y-2"><Label>Description</Label><Textarea value={newCommDesc} onChange={(e) => setNewCommDesc(e.target.value)} placeholder="About..." /></div></div><DialogFooter><Button onClick={() => createCommunity.mutate()} disabled={!newCommName.trim()}>Create Community</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
