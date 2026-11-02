import styles from "./MediaSection.module.css";

export function MediaSection({
  title,
  url,
  type,
  annotationTitle,
}: {
  title: string;
  url: string | null;
  type: "photo" | "audio";
  annotationTitle: string;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{title}</h3>
      {url ? (
        type === "photo" ? (
          <>
            <img
              className={styles.image}
              src={url}
              alt={`Photo for ${annotationTitle}`}
            />
          </>
        ) : (
          <>
            <audio className={styles.audio} controls preload="none" src={url} />
          </>
        )
      ) : (
        <span className={styles.muted}>No {type}</span>
      )}
    </section>
  );
}
