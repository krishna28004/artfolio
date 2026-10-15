import styles from "./ArtworkScribbleLoader.module.css";

export function ArtworkScribbleLoader({ label = "Loading artwork" }: { label?: string }) {
  return (
    <div className={styles.loader} role="status" aria-label={label}>
      <svg className={styles.drawing} viewBox="0 0 64 64" aria-hidden="true">
        <path className={styles.circle} pathLength="1" d="M32.7 7.8C45.1 7.2 55.7 17.1 56.2 30.1c.5 12.9-8.8 24.1-21.8 25.2C21.3 56.4 9 47.6 8 34.6 7 21.7 16.7 9.8 29.3 8.1" />
        <path className={styles.retrace} pathLength="1" d="M30.5 11.2C19.6 12 11.8 21.5 12.5 32.5c.7 10.7 9.4 19.1 20.1 19.2" />
        <path className={styles.gold} d="M46.8 48.2l3.1 2.2" />
        <circle className={styles.tip} cx="50" cy="50" r="1.5" />
      </svg>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
