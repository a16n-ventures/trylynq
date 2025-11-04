// src/hooks/useGeolocation.tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const LOCAL_KEY = 'last_known_location';

export const useGeolocation = () => {
  const [location, setLocation] = useState<LocationData | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const watchId = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      toast.error('Geolocation not supported.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const saveLocal = (loc: LocationData) => {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(loc));
      } catch {
        // ignore storage quota errors
      }
    };

    const updateLastSeen = async (isOnline: boolean) => {
      try {
        await supabase
          .from('user_locations')
          .update({
            is_sharing_location: isOnline,
            last_seen: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Failed to update last_seen:', err);
      }
    };

    const updateLocation = async (pos: GeolocationPosition) => {
      if (cancelled) return;

      const loc: LocationData = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };

      setLocation(loc);
      setError(null);
      setLoading(false);
      saveLocal(loc);

      // Prevent too-frequent updates
      const now = Date.now();
      if (now - lastSentRef.current < 30000) return;
      lastSentRef.current = now;

      try {
        const { error } = await supabase
          .from('user_locations')
          .upsert({
            user_id: user.id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            is_sharing_location: true,
            last_seen: new Date().toISOString(),
          });
        if (error) throw error;
      } catch (err) {
        console.error('Location update error:', err);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Geolocation error:', err);

      let message = 'Unable to access your location.';
      if (err.code === 1) message = 'Permission denied for location access.';
      else if (err.code === 2) message = 'Position unavailable.';
      else if (err.code === 3) message = 'Location request timed out.';

      setError(message);
      toast.error(message);
      setLoading(false);

      const fallback =
        location ||
        { latitude: 6.5244, longitude: 3.3792, accuracy: 1000 };

      setLocation(fallback);
      saveLocal(fallback);

      // Mark user as offline if location fails
      updateLastSeen(false);
    };

    // One-time fetch
    navigator.geolocation.getCurrentPosition(updateLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });

    // Continuous tracking
    watchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 60000,
      }
    );

    // Mark online
    updateLastSeen(true);

    // When the tab/browser closes, mark offline
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateLastSeen(false);
      } else {
        updateLastSeen(true);
      }
    };

    window.addEventListener('beforeunload', () => updateLastSeen(false));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      updateLastSeen(false);
      window.removeEventListener('beforeunload', () => updateLastSeen(false));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  return { location, error, loading };
};
