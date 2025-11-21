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
  MessageSquare, Paperclip, X, Image as ImageIcon, Loader2, 
  MoreVertical, Phone, Video, Smile, Info, UserPlus,
  Shield, Trash2, Ban, Volume2, VolumeX, Crown, Check
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
  is_muted?: boolean;
  is_banned?: boolean;
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
      is_muted?: boolean;
    };

// --- MESSAGE BUBBLE COMPONENT ---
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
          
          {/* Message Actions */}
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
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      // Delete all members first
      await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId);
      
      // Delete all messages
      await supabase
        .from('community_messages')
        .delete()
        .eq('community_id', communityId);
      
      // Delete community
      await supabase
        .from('communities')
        .delete()
        .eq('id', communityId);
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
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');

// --- QUERIES ---
  const { data: dmList = [], isLoading: loadingDMs } = useQuery({
    queryKey: ['dm_list'],
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
        if (!map.has(partner.user_id)) {
          map.set(partner.user_id, {
            type: 'dm',
            id: partner.user_id,
            partner_id: partner.user_id,
            name: partner.display_name,
            avatar: partner.avatar_url,
            last_msg: msg.content || '📷 Photo',
            time: msg.created_at,
            is_online: false
          });
        }
      });
      return Array.from(map.values());
    }
  });

  const { data: commList = [], isLoading: loadingComms } = useQuery({
    queryKey: ['comm_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communities')
        .select(`*, members:community_members(user_id, role)`);
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
      const { data } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');
      return data?.map((f: any) => {
        const profile = f.requester_id === user.id ? f.addressee : f.requester;
        return { 
          id: profile.user_id, 
          name: profile.display_name, 
          avatar: profile.avatar_url 
        };
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
        is_me: m.sender_id === user.id 
      })) as Message[] || [];
    },
    enabled: !!selectedChat,
    refetchInterval: 3000
  });

  // --- MUTATIONS ---
  const joinCommunity = useMutation({
    mutationFn: async (communityId: string) => {
      const { error } = await supabase
        .from('community_members')
        .insert({ 
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

  const createCommunity = useMutation({
    mutationFn: async () => {
      if (!user) return;
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
