import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, Share, MapPin, Calendar, Users, Plus, Image, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SocialFeed = () => {
  const [postText, setPostText] = useState('');
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          profiles!social_posts_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setFeedPosts(posts || []);
    } catch (error) {
      console.error('Fetch posts error:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!postText.trim()) {
      toast.error('Please write something');
      return;
    }

    try {
      const { error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user?.id,
          content: postText.trim(),
          post_type: 'status'
        });

      if (error) throw error;

      toast.success('Post created!');
      setPostText('');
      fetchPosts();
    } catch (error) {
      console.error('Create post error:', error);
      toast.error('Failed to create post');
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'event':
        return <Calendar className="w-4 h-4" />;
      case 'location':
        return <MapPin className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const PostCard = ({ post }) => {
    const author = post.profiles;
    const timeAgo = new Date(post.created_at).toLocaleDateString();
    
    return (
      <Card className="gradient-card shadow-card border-0">
        <CardContent className="p-4">
          {/* Post Header */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={author?.avatar_url} />
              <AvatarFallback className="gradient-primary text-white text-sm">
                {author?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{author?.display_name || 'User'}</h3>
                {post.post_type !== 'status' && (
                  <Badge variant="secondary" className="text-xs">
                    {getPostTypeIcon(post.post_type)}
                    <span className="ml-1 capitalize">{post.post_type}</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>

          {/* Post Content */}
          <div className="mb-3">
            <p className="text-sm">{post.content}</p>
            
            {post.image_url && (
              <div className="mt-3 rounded-lg overflow-hidden">
                <img src={post.image_url} alt="Post" className="w-full h-auto" />
              </div>
            )}
          </div>

          {/* Post Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Button variant="ghost" size="sm" className="flex-1">
              <Heart className="w-4 h-4 mr-1" />
              {post.likes_count || 0}
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              <MessageCircle className="w-4 h-4 mr-1" />
              {post.comments_count || 0}
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              <Share className="w-4 h-4 mr-1" />
              0
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <h1 className="heading-lg text-white">Social Feed</h1>
          <p className="opacity-90">What's happening around you</p>
        </div>
      </div>
      <div className="container-mobile py-6 space-y-6">
        {/* Create Post */}
        <Card className="gradient-card shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="gradient-primary text-white">U</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea
                  placeholder="What's on your mind?"
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Image className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Video className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MapPin className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button size="sm" className="gradient-primary text-white" onClick={handleCreatePost}>
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feed Posts */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading posts...</p>
          ) : feedPosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No posts yet. Be the first to share!</p>
          ) : (
            feedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialFeed;
