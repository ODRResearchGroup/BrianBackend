import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import styles from "./LocationMap.module.css";

const markerIcon = L.divIcon({
  className: "",
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">
      <path d="M15 1C7.27 1 1 7.27 1 15c0 10.5 14 26 14 26s14-15.5 14-26C29 7.27 22.73 1 15 1Z" fill="#d94841" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="#fff"/>
    </svg>
  `,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -42],
});

export function LocationMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return (
    <div className={styles.container}>
      <MapContainer
        className={styles.map}
        center={[latitude, longitude]}
        zoom={14}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={markerIcon}>
          <Popup>
            {latitude}, {longitude}
          </Popup>
        </Marker>
      </MapContainer>
      <p className={styles.coordinates}>
        Latitude: <strong>{latitude}</strong> · Longitude:{" "}
        <strong>{longitude}</strong>
      </p>
    </div>
  );
}
