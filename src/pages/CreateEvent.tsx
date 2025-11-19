import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, MapPin, DollarSign, ArrowLeft, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query'; // <--- 1. Added Import

const CreateEvent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient(); // <--- 2. Initialize Client
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    capacity: '',
    price: '',
    category: '',
    isPrivate: false,
    requireApproval: false
  });

  const categories = [
    'Study Group',
    'Social Hangout',
    'Sports & Fitness',
    'Food & Dining',
    'Entertainment',
    'Networking',
    'Other'
  ];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to create an event');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Handle Image Upload (if exists)
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event_images') // Ensure this bucket exists in Supabase
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event_images')
          .getPublicUrl(fileName);
          
        imageUrl = publicUrl;
      }

      // 2. Construct Timestamp
      // Combine date and time into a proper ISO string
      const startDateTime = new Date(`${eventData.date}T${eventData.time}`);
      if (isNaN(startDateTime.getTime())) {
        throw new Error("Invalid date or time format");
      }

      // 3. Insert Event
      const { error } = await supabase
        .from('events')
        .insert({
          title: eventData.title,
          description: eventData.description,
          category: eventData.category,
          location: eventData.location,
          start_date: startDateTime.toISOString(),
          // Default duration 2 hours if not specified, or null
          end_date: null, 
          max_attendees: eventData.capacity ? parseInt(eventData.capacity) : null,
          ticket_price: eventData.price ? parseFloat(eventData.price) : 0,
          is_public: !eventData.isPrivate,
          requires_approval: eventData.requireApproval, // Corrected column name per convention
          creator_id: user.id,
          image_url: imageUrl
        });

      if (error) throw error;

      toast.success('Event created successfully!');
      
      // <--- 3. Force Refresh of Events List --->
      await queryClient.invalidateQueries({ queryKey: ['events'] });

      navigate('/app/events'); // Redirect to events list
      
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="gradient-primary text-white">
        <div className="container-mobile py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20 p-2"
              onClick={() => navigate('/app')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="heading-lg text-white">Create Event</h1>
          </div>
        </div>
      </div>

      <div className="container-mobile py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Image Upload */}
          <Card className="border-dashed border-2 border-muted-foreground/20 shadow-none bg-muted/5">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              {imagePreview ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <label htmlFor="image-upload" className="text-primary font-semibold cursor-pointer hover:underline">
                      Click to upload
                    </label> a cover image
                    <input 
                      id="image-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageSelect}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="heading-lg">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  placeholder="What's your event about?"
                  value={eventData.title}
                  onChange={(e) => setEventData({...eventData, title: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell people more about your event..."
                  value={eventData.description}
                  onChange={(e) => setEventData({...eventData, description: e.target.value})}
                  className="min-h-[100px]"
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  onValueChange={(value) => setEventData({...eventData, category: value})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Date & Time */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                When
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={eventData.date}
                    onChange={(e) => setEventData({...eventData, date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={eventData.time}
                    onChange={(e) => setEventData({...eventData, time: e.target.value})}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Where
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Where will your event take place?"
                  value={eventData.location}
                  onChange={(e) => setEventData({...eventData, location: e.target.value})}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Capacity & Pricing */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Tickets & Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="capacity">Max Attendees</Label>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="Unlimited"
                    value={eventData.capacity}
                    onChange={(e) => setEventData({...eventData, capacity: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="price">Ticket Price (₦)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                    <Input
                      id="price"
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={eventData.price}
                      onChange={(e) => setEventData({...eventData, price: e.target.value})}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
              
              {parseFloat(eventData.price) > 0 && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee (2%)</span>
                    <span>- ₦{(parseFloat(eventData.price) * 0.02).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t border-border">
                    <span>You Receive</span>
                    <span className="text-green-600">₦{(parseFloat(eventData.price) * 0.98).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card className="gradient-card shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle>Privacy Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="private">Private Event</Label>
                  <p className="text-sm text-muted-foreground">Only invited friends can see this</p>
                </div>
                <Switch
                  id="private"
                  checked={eventData.isPrivate}
                  onCheckedChange={(checked) => setEventData({...eventData, isPrivate: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="approval">Require Approval</Label>
                  <p className="text-sm text-muted-foreground">Manually approve attendees</p>
                </div>
                <Switch
                  id="approval"
                  checked={eventData.requireApproval}
                  onCheckedChange={(checked) => setEventData({...eventData, requireApproval: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="grid grid-cols-2 gap-4 sticky bottom-4 z-10">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate('/app')}
              disabled={isSubmitting}
              className="bg-background/80 backdrop-blur-sm"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary text-white shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Event'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvent;
