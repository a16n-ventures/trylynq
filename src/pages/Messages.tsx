import React, { useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { 
  Search, Send, ArrowLeft, Plus, Settings, Users, 
  MessageSquare, Paperclip, X, Loader2, 
  MoreVertical, Phone, Video, Info, UserPlus,
  Shield, Trash2, Ban, Crown
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  is_deleted?: boolean;
}

interface CommunityMember {
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  profile: { display_name: string; avatar_url: string; };
  joined_at: string;
}

type SelectedChat = 
  | { type: 'dm'; id: string; partner_id: string; name: string; avatar?: string; is_online?: boolean; }
  | { 
      type: 'community'; 
      id: string; 
      name: string; 
      avatar?: string; 
      description?: string; 
      my_role: 'admin' | 'moderator' | 'member' | 'none'; 
      member_count: number;
    };

// --- HELPER: Safe Date Formatting ---
const formatTime = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

// --- MESSAGE BUBBLE ---
const MessageBubble = ({ 
  msg, 
  prevMsg, 
  isComm,
  canModerate,
  onDelete 
}: { 
  msg: Message;
  prevMsg: Message | null;
  isComm: boolean;
  canModerate: boolean;
  onDelete: (msgId: string) => void;
}) => {
  const isSequence = prevMsg && prevMsg.sender_id === msg.sender_id;
  const [showMenu, setShowMenu] = useState(false);
  
  if (msg.is_deleted) {
    return (
      <div className="flex w-full mb-1 justify-start">
        <div className="flex items-center gap-2 text-muted-foreground text-xs italic py-2">
          <Trash2 className="w-3 h-3" />
          <span>Message deleted</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex w-full mb-1 group ${msg.is_me ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
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
        {!msg.is_me && isComm && !isSequence && (
          <span className="text-[10px] ml-1 mb-1 text-muted-foreground font-medium">
            {msg.sender_name}
          </span>
        )}

        <div className="relative group/message">
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
            {msg.image_url && (
              <img 
                src={msg.image_url} 
                alt="Attachment" 
                className={`max-w-full rounded-xl mb-1 border ${msg.is_me ? 'border-primary/20' : 'border-border'}`} 
                style={{ maxHeight: '200px', objectFit: 'cover' }} 
              />
            )}

            {msg.content && (
              <p className={msg.image_url ? (msg.is_me ? "bg-primary text-primary-foreground p-2 rounded-xl mt-1" : "bg-white dark:bg-muted p-2 rounded-xl mt-1 border") : ""}>
                {msg.content}
              </p>
            )}
          </div>
          
          {(msg.is_me || canModerate) && showMenu && (
            <div className={`absolute top-0 ${msg.is_me ? 'right-full mr-2' : 'left-full ml-2'} flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-background border shadow-sm">
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={msg.is_me ? "end" : "start"}>
                  {msg.is_me && (
                    <DropdownMenuItem onClick={() => onDelete(msg.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                  {!msg.is_me && canModerate && (
                    <DropdownMenuItem onClick={() => onDelete(msg.id)} className="text-red-600">
                      <Shield className="w-4 h-4 mr-2" />
                      Remove Message
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        <span className="text-[9px] text-muted-foreground mt-1 px-1 opacity-70">
          {formatTime(msg.created_at)}
        </span>
      </div>
    </div>
  );
};

// --- COMMUNITY INFO DIALOG ---
const CommunityInfoDialog = ({ 
  isOpen, 
  onClose, 
  community 
}: { 
  isOpen: boolean;
  onClose: () => void;
  community: SelectedChat | null;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ['comm_members', community?.id],
    queryFn: async () => {
      if (!community || community.type !== 'community') return [];
      const { data, error } = await supabase
        .from('community_members')
        .select('user_id, role, joined_at, profile:profiles(display_name, avatar_url)')
        .eq('community_id', community.id)
        .order('role', { ascending: true });
      if (error) throw error;
      return data as unknown as CommunityMember[];
    },
    enabled: isOpen && !!community
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'moderator' | 'member' }) => {
      if (!community || community.type !== 'community') return;
      await supabase
        .from('community_members')
        .update({ role: newRole })
        .match({ community_id: community.id, user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comm_members'] });
      toast.success("Role updated");
    }
  });

  const kickMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!community || community.type !== 'community') return;
      await supabase
        .from('community_members')
        .delete()
        .match({ community_id: community.id, user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comm_members'] });
      toast.success("Member removed");
    }
  });

  if (!community || community.type !== 'community') return null;

  const canModerate = community.my_role === 'admin' || community.my_role === 'moderator';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 rounded-xl">
              <AvatarImage src={community.avatar} />
              <AvatarFallback>{community.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>{community.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {community.member_count} members
              </p>
            </div>
          </div>
        </DialogHeader>

        {community.description && (
          <div className="py-3 border-b">
            <p className="text-sm text-muted-foreground">{community.description}</p>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Members
          </h3>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 pr-4">
              {members.map((m) => {
                const isMe = m.user_id === user?.id;
                const canManage = canModerate && !isMe && m.role !== 'admin';

                return (
                  <div 
                    key={m.user_id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={m.profile.avatar_url} />
                        <AvatarFallback>{m.profile.display_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {m.profile.display_name}
                          </span>
                          {isMe && <Badge variant="outline" className="text-xs">You</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.role === 'admin' && (
                            <Badge className="text-xs bg-amber-500">
                              <Crown className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {m.role === 'moderator' && (
                            <Badge className="text-xs bg-blue-500">
                              <Shield className="w-3 h-3 mr-1" />
                              Mod
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Joined {new Date(m.joined_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage Member</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {community.my_role === 'admin' && m.role !== 'moderator' && (
                            <DropdownMenuItem 
                              onClick={() => promoteMutation.mutate({ userId: m.user_id, newRole: 'moderator' })}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              Make Moderator
                            </DropdownMenuItem>
                          )}
                          {community.my_role === 'admin' && m.role === 'moderator' && (
                            <DropdownMenuItem 
                              onClick={() => promoteMutation.mutate({ userId: m.user_id, newRole: 'member' })}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              Remove Moderator
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => kickMutation.mutate(m.user_id)}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Remove from Group
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- COMMUNITY SETTINGS DIALOG ---
const CommunitySettingsDialog = ({ 
  isOpen, 
  onClose, 
  communityId, 
  currentName, 
  currentDesc 
}: { 
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  currentName: string;
  currentDesc: string;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentName);
  const [desc, setDesc] = useState(currentDesc);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from('communities')
        .update({ name, description: desc })
        .eq('id', communityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
      toast.success("Community updated");
      onClose();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('community_members').delete().eq('community_id', communityId);
      await supabase.from('community_messages').delete().eq('community_id', communityId);
      await supabase.from('communities').delete().eq('id', communityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
      toast.success("Community deleted");
      setShowDeleteDialog(false);
      onClose();
    }
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Community Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Community Name</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Enter community name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={desc} 
                onChange={(e) => setDesc(e.target.value)} 
                placeholder="Describe your community..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="destructive" 
              className="w-full sm:w-auto"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Community
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button 
                onClick={() => updateMutation.mutate()} 
                disabled={updateMutation.isPending || !name.trim()}
                className="flex-1 sm:flex-none"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Community?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All messages and member data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Delete Community'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// --- MAIN COMPONENT ---
export default function Messages() {
  // FIX 1: Handle loading state safely from AuthContext
  // Note: If your AuthContext doesn't return 'loading', you can remove it from destructuring
  // but ensure 'user' isn't accessed while null.
  const authContext = useAuth();
  const user = authContext?.user;
  // @ts-ignore - handling case where loading might not be in type definition
  const authLoading = authContext?.loading;

  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [activeTab, setActiveTab] = useState<ChatMode>('dm');
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');

  // --- QUERIES ---
  const { data: dmList = [], isLoading: loadingDMs } = useQuery({
    queryKey: ['dm_list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const map = new Map();
      data?.forEach((msg: any) => {
        const partner = msg.sender_id === user.id ? msg.receiver : msg.sender;
        // FIX 2: Added Safe Guard for partner existence
        if (partner && partner.user_id && !map.has(partner.user_id)) {
          map.set(partner.user_id, {
            type: 'dm',
            id: partner.user_id,
            partner_id: partner.user_id,
            name: partner.display_name || 'Unknown User',
            avatar: partner.avatar_url,
            last_msg: msg.content || '📷 Photo',
            time: msg.created_at
          });
        }
      });
      return Array.from(map.values());
    },
    enabled: !!user
  });

  const { data: commList = [], isLoading: loadingComms } = useQuery({
    queryKey: ['comm_list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('communities')
        .select(`*, members:community_members(user_id, role)`);

      return data?.map((c: any) => {
        const myMembership = c.members?.find((m: any) => m.user_id === user?.id);
        return {
          type: 'community',
          id: c.id,
          name: c.name,
          description: c.description,
          avatar: c.avatar_url,
          member_count: c.member_count || 0,
          my_role: myMembership ? myMembership.role : 'none',
          is_joined: !!myMembership
        };
      }) || [];
    },
    enabled: !!user
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['my_friends', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');
      return data?.map((f: any) => {
        const profile = f.requester_id === user.id ? f.addressee : f.requester;
        if (!profile) return null;
        return { 
          id: profile.user_id, 
          name: profile.display_name, 
          avatar: profile.avatar_url 
        };
      }).filter(Boolean) || []; // Filter out any null profiles
    },
    enabled: !!user && isNewChatOpen
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedChat?.type, selectedChat?.id, user?.id],
    queryFn: async () => {
      if (!user || !selectedChat) return [];
      let data;
      if (selectedChat.type === 'dm') {
        const res = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedChat.partner_id}),and(sender_id.eq.${selectedChat.partner_id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });
        data = res.data;
      } else {
        const res = await supabase
          .from('community_messages')
          .select('*, sender:profiles!sender_id(display_name, avatar_url)')
          .eq('community_id', selectedChat.id)
          .order('created_at', { ascending: true });
        data = res.data?.map((m: any) => ({ 
          ...m, 
          sender_name: m.sender?.display_name, 
          sender_avatar: m.sender?.avatar_url 
        }));
      }
      return data?.map((m: any) => ({ 
        ...m, 
        is_me: m.sender_id === user.id,
        is_deleted: m.is_deleted || false
      })) as Message[] || [];
    },
    enabled: !!selectedChat && !!user,
    refetchInterval: 3000
  });

  // --- MUTATIONS ---
  const joinCommunity = useMutation({
    mutationFn: async (communityId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from('community_members')
        .insert({ 
          community_id: communityId, 
          user_id: user.id, 
          role: 'member' 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Joined community!");
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
    }
  });

  const createCommunity = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: comm, error } = await supabase
        .from('communities')
        .insert({ 
          name: newCommName, 
          description: newCommDesc, 
          creator_id: user.id, 
          member_count: 1 
        })
        .select()
        .single();
      if (error) throw error;
      await supabase
        .from('community_members')
        .insert({ 
          community_id: comm.id, 
          user_id: user.id, 
          role: 'admin' 
        });
      return comm;
    },
    onSuccess: () => {
      setIsCreateCommunityOpen(false);
      setNewCommName('');
      setNewCommDesc('');
      queryClient.invalidateQueries({ queryKey: ['comm_list'] });
      toast.success("Community created!");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if ((!messageInput.trim() && !imageFile) || !selectedChat || !user) return;
      
      let imageUrl = null;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase
          .storage
          .from('chat-attachments')
          .upload(filePath, imageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase
          .storage
          .from('chat-attachments')
          .getPublicUrl(filePath);
        imageUrl = publicUrl;
      }

      const payload = { 
        sender_id: user.id, 
        content: messageInput.trim() || null, 
        image_url: imageUrl 
      };
      
      if (selectedChat.type === 'dm') {
        await supabase
          .from('messages')
          .insert({ ...payload, receiver_id: selectedChat.partner_id });
      } else {
        await supabase
          .from('community_messages')
          .insert({ ...payload, community_id: selectedChat.id });
      }
    },
    onSuccess: () => {
      setMessageInput('');
      setImageFile(null);
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['dm_list'] });
    },
    onError: (e: any) => toast.error("Failed to send: " + e.message)
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!selectedChat) return;
      
      if (selectedChat.type === 'dm') {
        await supabase
          .from('messages')
          .update({ is_deleted: true, content: null, image_url: null })
          .eq('id', messageId);
      } else {
        await supabase
          .from('community_messages')
          .update({ is_deleted: true, content: null, image_url: null })
          .eq('id', messageId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success("Message deleted");
    }
  });

  // --- HANDLERS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large (max 5MB)");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage.mutate();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, imagePreview]);

  // FIX 3: Handle Initial Loading State safely
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- RENDER: CHAT VIEW ---
  if (selectedChat) {
    const isComm = selectedChat.type === 'community';
    const canType = !isComm || (isComm && selectedChat.my_role !== 'none');
    const canModerate = isComm && (selectedChat.my_role === 'admin' || selectedChat.my_role === 'moderator');

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col h-[100dvh]">
        
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center gap-3 bg-background/95 backdrop-blur shadow-sm shrink-0 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="-ml-2 rounded-full" 
            onClick={() => setSelectedChat(null)}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={selectedChat.avatar} />
            <AvatarFallback>{selectedChat.name[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsInfoOpen(true)}>
            <h3 className="font-semibold text-sm truncate">{selectedChat.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {isComm ? (
                <>
                  <Users className="w-3 h-3" /> 
                  {selectedChat.member_count} members
                  {selectedChat.my_role === 'admin' && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                      <Crown className="w-2.5 h-2.5 mr-0.5" />
                      Admin
                    </Badge>
                  )}
                  {selectedChat.my_role === 'moderator' && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                      <Shield className="w-2.5 h-2.5 mr-0.5" />
                      Mod
                    </Badge>
                  )}
                </>
              ) : (
                <span className="flex items-center gap-1 text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                  Online
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            {!isComm && (
              <>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Video className="w-5 h-5 text-muted-foreground" />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsInfoOpen(true)}>
                  <Info className="w-4 h-4 mr-2" />
                  {isComm ? 'Community Info' : 'View Profile'}
                </DropdownMenuItem>
                {isComm && selectedChat.my_role === 'admin' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isComm ? 'Leave Community' : 'Delete Conversation'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Dialogs */}
        {isComm && (
          <>
            <CommunityInfoDialog 
              isOpen={isInfoOpen}
              onClose={() => setIsInfoOpen(false)}
              community={selectedChat}
            />
            {selectedChat.my_role === 'admin' && (
              <CommunitySettingsDialog 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                communityId={selectedChat.id}
                currentName={selectedChat.name}
                currentDesc={selectedChat.description || ''}
              />
            )}
          </>
        )}

        {/* Messages Area */}
        <div 
          className="flex-1 overflow-y-auto bg-muted/10 p-4 scroll-smooth" 
          ref={scrollRef}
        >
          <div className="flex flex-col justify-end min-h-full pb-2">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-50 py-12">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Start the conversation</h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  {isComm 
                    ? "Be the first to send a message in this community" 
                    : "Send a message to start chatting"}
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageBubble 
                  key={m.id} 
                  msg={m} 
                  prevMsg={i > 0 ? messages[i-1] : null} 
                  isComm={isComm}
                  canModerate={canModerate}
                  onDelete={(msgId) => deleteMessage.mutate(msgId)}
                />
              ))
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 border-t bg-background shrink-0">
          {canType ? (
            <div className="flex flex-col gap-3">
              {imagePreview && (
                <div className="relative w-24 h-24 bg-muted rounded-xl overflow-hidden border-2 border-primary/20">
                  <img 
                    src={imagePreview} 
                    className="w-full h-full object-cover" 
                    alt="preview" 
                  />
                  <button 
                    onClick={() => { 
                      setImageFile(null); 
                      setImagePreview(null); 
                    }} 
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                />
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full text-muted-foreground hover:text-primary shrink-0" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                
                <div className="flex-1 relative">
                  <Textarea 
                    value={messageInput} 
                    onChange={(e) => setMessageInput(e.target.value)} 
                    placeholder="Type a message..." 
                    className="min-h-[44px] max-h-32 py-3 pr-10 resize-none rounded-2xl bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all"
                    onKeyDown={handleKeyPress}
                  />
                </div>

                <Button 
                  size="icon" 
                  onClick={() => sendMessage.mutate()} 
                  disabled={sendMessage.isPending || (!messageInput.trim() && !imageFile)}
                  className="rounded-full h-11 w-11 shadow-md shrink-0"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 ml-0.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              className="w-full rounded-xl shadow-md" 
              onClick={() => joinCommunity.mutate(selectedChat.id)}
              disabled={joinCommunity.isPending}
            >
              {joinCommunity.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Join Community to Chat
            </Button>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER: LIST VIEW ---
  return (
    <div className="min-h-screen flex flex-col pb-20 bg-background">
      {/* FIX 4: Replaced custom 'container-mobile' with standard tailwind container to ensure visibility */}
      <div className="container max-w-4xl mx-auto pt-6 px-4">
        <div className="flex items-center justify-between mb-6 px-1">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Connect with your circle
            </p>
          </div>
          <Button 
            size="icon" 
            className="rounded-full shadow-lg bg-primary hover:bg-primary/90 h-10 w-10" 
            onClick={() => activeTab === 'dm' ? setIsNewChatOpen(true) : setIsCreateCommunityOpen(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as ChatMode)} 
          className="w-full"
        >
          <div className="px-1 mb-4">
            <div className="bg-muted/50 p-1 rounded-xl flex">
              <TabsTrigger 
                value="dm" 
                className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Direct
              </TabsTrigger>
              <TabsTrigger 
                value="community" 
                className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Users className="w-4 h-4 mr-2" />
                Communities
              </TabsTrigger>
            </div>
            
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search conversations..." 
                className="pl-10 bg-muted/30 border-transparent rounded-xl focus:bg-background focus:border-primary/20 transition-all" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>

          <TabsContent value="dm" className="space-y-2 animate-in fade-in-50 px-1 mt-0">
            {loadingDMs ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading chats...</p>
              </div>
            ) : dmList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No messages yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  Start a conversation with your friends
                </p>
                <Button variant="outline" onClick={() => setIsNewChatOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Message
                </Button>
              </div>
            ) : (
              dmList
                .filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((chat: any) => (
                  <div 
                    key={chat.id} 
                    onClick={() => setSelectedChat(chat)} 
                    className="group flex items-center gap-4 p-3 hover:bg-muted/50 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-border/50 active:scale-[0.98]"
                  >
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                        <AvatarImage src={chat.avatar} />
                        <AvatarFallback>{chat.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"></span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-base truncate">{chat.name}</h3>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {formatTime(chat.time)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate font-medium opacity-80">
                        {chat.last_msg}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </TabsContent>

          <TabsContent value="community" className="space-y-2 animate-in fade-in-50 px-1 mt-0">
            {loadingComms ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading communities...</p>
              </div>
            ) : commList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No communities yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  Create or join a community to get started
                </p>
                <Button variant="outline" onClick={() => setIsCreateCommunityOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Community
                </Button>
              </div>
            ) : (
              commList
                .filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((comm: any) => (
                  <div 
                    key={comm.id} 
                    className="flex items-center gap-4 p-3 hover:bg-muted/50 rounded-2xl transition-all border border-transparent hover:border-border/50"
                  >
                    <Avatar className="h-14 w-14 rounded-2xl border shadow-sm">
                      <AvatarImage src={comm.avatar} />
                      <AvatarFallback className="rounded-2xl bg-primary/10 text-primary">
                        {comm.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer" 
                      onClick={() => setSelectedChat(comm)}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base truncate">{comm.name}</h3>
                        {comm.my_role === 'admin' && (
                          <Badge variant="secondary" className="text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                        {comm.my_role === 'moderator' && (
                          <Badge variant="secondary" className="text-xs">
                            <Shield className="w-3 h-3 mr-1" />
                            Mod
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Users className="w-3 h-3"/> 
                        {comm.member_count} members
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant={comm.my_role !== 'none' ? "outline" : "default"} 
                      className={comm.my_role !== 'none' 
                        ? "text-muted-foreground" 
                        : "rounded-full px-6 shadow-md"
                      }
                      onClick={comm.my_role !== 'none' 
                        ? () => setSelectedChat(comm) 
                        : () => joinCommunity.mutate(comm.id)
                      }
                    >
                      {comm.my_role !== 'none' ? (
                        <>
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Open
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Join
                        </>
                      )}
                    </Button>
                  </div>
                ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              Start a conversation with your friends
            </DialogDescription>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search friends..." className="pl-10 bg-muted/50" />
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-1">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No friends yet</p>
                  <p className="text-xs mt-1">Add friends to start chatting</p>
                </div>
              ) : (
                friends.map((f: any) => (
                  <div 
                    key={f.id} 
                    onClick={() => { 
                      setSelectedChat({ 
                        type: 'dm', 
                        id: f.id, 
                        partner_id: f.id, 
                        name: f.name, 
                        avatar: f.avatar 
                      }); 
                      setIsNewChatOpen(false); 
                    }} 
                    className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors active:scale-[0.98]"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={f.avatar} />
                      <AvatarFallback>{f.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{f.name}</span>
                      <p className="text-xs text-muted-foreground">Tap to message</p>
                    </div>
                    <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateCommunityOpen} onOpenChange={setIsCreateCommunityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Community</DialogTitle>
            <DialogDescription>
              Bring people together around shared interests
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Community Name</Label>
              <Input 
                value={newCommName} 
                onChange={(e) => setNewCommName(e.target.value)} 
                placeholder="e.g. Tech Enthusiasts" 
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={newCommDesc} 
                onChange={(e) => setNewCommDesc(e.target.value)} 
                placeholder="What's your community about?" 
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCommunityOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createCommunity.mutate()} 
              disabled={!newCommName.trim() || createCommunity.isPending}
            >
              {createCommunity.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Users className="w-4 h-4 mr-2" />
              )}
              Create Community
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}