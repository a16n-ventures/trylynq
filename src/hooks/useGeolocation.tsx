import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      toast.error('Geolocation not supported');
      setLoading(false);
      return;
    }

    // Try one-time location first
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLocation(loc);
        setError(null);
        setLoading(false);

        try {
          const { error } = await supabase
            .from('user_locations')
            .upsert({
              user_id: user.id,
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              is_sharing_location: true,
            });
          if (error) throw error;
        } catch (err) {
          console.error('Location update error:', err);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setError('Unable to access your location.');
        toast.error('Unable to access your location.');
        setLoading(false);
        // provide fallback so map can still show
        setLocation({ latitude: 6.5244, longitude: 3.3792, accuracy: 1000 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [user]);

  return { location, error, loading };
};
