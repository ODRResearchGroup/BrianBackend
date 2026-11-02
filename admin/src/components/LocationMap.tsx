import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import styles from "./LocationMap.module.css";

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
        <Marker position={[latitude, longitude]}>
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
