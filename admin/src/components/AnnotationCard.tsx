import { Annotation } from "../types";
import { LocationMap } from "./LocationMap";
import { MediaSection } from "./MediaSection";
import styles from "./AnnotationCard.module.css";
import DeleteIcon from "@mui/icons-material/Delete";

export function AnnotationCard({
  annotation,
  onDelete,
}: {
  annotation: Annotation;
  onDelete: () => void;
}) {
  const hasLocation =
    annotation.latitude !== null && annotation.longitude !== null;

  return (
    <article className={styles.annotation}>
      <div className={styles.heading}>
        <h2>{annotation.title || "Untitled"}</h2>
        <div className={styles.rightHeading}>
          <time>{new Date(annotation.timestamp).toLocaleString()}</time>
          <button className={styles.delete} onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </button>
        </div>
      </div>
      <dl>
        <dt>Note</dt>
        <dd>{annotation.note || "—"}</dd>
        <dt>Device</dt>
        <dd>{annotation.deviceName || "—"}</dd>
        <dt>Smell walk</dt>
        <dd>{annotation.smellWalkId || "—"}</dd>
      </dl>
      <div className={styles.grid}>
        <pre>{JSON.stringify(annotation.sensorReadings, null, 2)}</pre>
        {hasLocation ? (
          <LocationMap
            latitude={annotation.latitude!}
            longitude={annotation.longitude!}
          />
        ) : (
          <p className={styles.muted}>No location recorded.</p>
        )}
      </div>
      <hr className={styles.divider} />
      <div className={styles.grid}>
        <MediaSection
          title="Photo"
          url={annotation.photo}
          type="photo"
          annotationTitle={annotation.title}
        />
        <MediaSection
          title="Audio"
          url={annotation.audio}
          type="audio"
          annotationTitle={annotation.title}
        />
      </div>
    </article>
  );
}
