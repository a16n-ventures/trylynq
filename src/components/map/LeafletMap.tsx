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

  // fallback location (Lagos, Nigeria)
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const resize = () => map.invalidateSize();
    const timeout = setTimeout(resize, 800);
    window.addEventListener('resize', resize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const validFriends = friendsLocations.filter(
    (f) => typeof f.latitude === 'number' && typeof f.longitude === 'number'
  );

  console.log('LeafletMap render check');

  return (
    <div
      style={{
        height: '400px',
        width: '100%',
        background: 'red', // temporary 
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        whenCreated={(map) => {
          mapRef.current = map;
          setTimeout(() => map.invalidateSize(), 600);
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <>
            <MapCenter center={[userLocation.latitude, userLocation.longitude]} />
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              icon={userIcon}
            >
              <Popup>You are here</Popup>
            </Marker>
          </>
        )}

        {validFriends.map((f) => (
          <Marker key={f.id} position={[f.latitude!, f.longitude!]} icon={friendIcon}>
            <Popup>{f.name}</Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Overlay shown when no location or error */}
      {(!userLocation || error || loading) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
          {!loading && !error && !userLocation && 'Location not available. Showing default map.'}
        </div>
      )}
    </div>
  );
};
