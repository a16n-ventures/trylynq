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
      toast.error('Your browser does not support location services');
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const locationData: LocationData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        setLocation(locationData);
        setError(null);
        setLoading(false);

        try {
          const { error: upsertError } = await supabase
            .from('user_locations')
            .upsert({
              user_id: user.id,
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              is_sharing_location: true,
            })
            .onConflict('user_id');

          if (upsertError) throw upsertError;
        } catch (err) {
          console.error('Error updating location:', err);
          toast.error('Failed to update your location');
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Unable to get your location. Please check browser settings.');
        toast.error('Unable to access your location. Enable GPS and try again.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  return { location, error, loading };
};
