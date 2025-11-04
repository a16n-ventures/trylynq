'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeafletMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  friendsLocations: Array<{
    id: string;
    name: string;
    latitude?: number | null;
    longitude?: number | null;
  }>;
  loading?: boolean;
  error?: string | null;
}

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13, { animate: true });
  }, [center, map]);
  return null;
}

export const LeafletMap = ({
  userLocation,
  friendsLocations,
  loading,
  error,
}: LeafletMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const fallback: [number, number] = [6.5244, 3.3792];

  const center: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : fallback;

  const userIcon = new L.Icon({
    iconUrl:
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const friendIcon = new L.Icon({
    iconUrl:
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const validFriends = friendsLocations.filter(
    (f) => typeof f.latitude === 'number' && typeof f.longitude === 'number'
  );

  // Resize handling and auto-fit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Adjust to fit all markers if available
    if (validFriends.length > 0) {
      const bounds = L.latLngBounds(
        validFriends.map((f) => [f.latitude!, f.longitude!])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView(center, 13);
    }

    const resize = () => map.invalidateSize();
    setTimeout(resize, 800);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [center, validFriends]);

  return (
    <div
      style={{
        height: '60vh',
        width: '100%',
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Prevent SSR blank render */}
      {typeof window !== 'undefined' && (
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          ref={(map) => {
            if (map) {
              mapRef.current = map;
              setTimeout(() => map.invalidateSize(), 600);
            }
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {userLocation && (
            <>
              <MapCenter
                center={[userLocation.latitude, userLocation.longitude]}
              />
              <Marker
                position={[userLocation.latitude, userLocation.longitude]}
                icon={userIcon}
              >
                <Popup>You are here</Popup>
              </Marker>
            </>
          )}

          {validFriends.map((f) => (
            <Marker
              key={f.id}
              position={[f.latitude!, f.longitude!]}
              icon={friendIcon}
            >
              <Popup>{f.name}</Popup>
            </Marker>
          ))}
        </MapContainer>
      )}

      {/* Overlay for status/errors */}
      {(!userLocation || error || loading) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 14,
            textAlign: 'center',
            padding: 16,
          }}
        >
          {loading && 'Fetching your location...'}
          {error && !loading && error}
          {!loading &&
            !error &&
            !userLocation &&
            'Location not available. Showing default map.'}
        </div>
      )}
    </div>
  );
};
