import styles from "./Header.module.css";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

export function Header({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brandCopy}>
        <strong>BRIAN</strong>
        <span>Fingerprint archive</span>
      </div>
      <button className={styles.signOut} onClick={onSignOut}>
        <ExitToAppIcon fontSize="small" />
        <p className={styles.signOutText}>Sign out</p>
      </button>
    </header>
  );
}
