import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';

// 1. Import required CSS
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-markercluster/dist/styles.min.css';

// 2. Import the cluster component
import MarkerClusterGroup from 'react-leaflet-markercluster';

// --- Types (from Map.tsx) ---
type FriendOnMap = {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  latitude: number | null;
  longitude: number | null;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

interface LeafletMapProps {
  userLocation: UserLocation;
  friendsLocations: FriendOnMap[];
  loading: boolean;
  error: Error | null;
}

// --- Fix for default Leaflet icon ---
// (This is a common issue with React-Leaflet and Webpack)
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// --- Helper component to center map ---
const ChangeView = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  map.setView(center, zoom);
  return null;
};

// --- Custom Friend Icon ---
const friendIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/icons/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// --- Custom User Icon ---
const userIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/icons/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});


const LeafletMap = ({ userLocation, friendsLocations, loading }: LeafletMapProps) => {
  const userPosition: [number, number] = [userLocation.latitude, userLocation.longitude];

  return (
    <MapContainer
      center={userPosition}
      zoom={13}
      style={{ height: '400px', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      <ChangeView center={userPosition} zoom={13} />

      {/* User's Marker (Not clustered) */}
      {!loading && (
        <Marker position={userPosition} icon={userIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {/* 3. Wrap friend markers in the Cluster component */}
      <MarkerClusterGroup>
        {friendsLocations
          .filter(friend => friend.latitude && friend.longitude) // Only map valid locations
          .map(friend => (
            <Marker
              key={friend.user_id}
              position={[friend.latitude!, friend.longitude!]}
              icon={friendIcon}
            >
              <Popup>
                <div className="flex items-center gap-2">
                  <img src={friend.avatar_url || ''} alt={friend.display_name} className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="font-semibold">{friend.display_name}</p>
                    <Button size="sm" className="mt-1 h-7">View</Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MarkerClusterGroup>

    </MapContainer>
  );
};

export default LeafletMap;
