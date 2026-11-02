import type { FormEvent } from "react";
import styles from "./LoginForm.module.css";

type Login = { username: string; password: string };

export function LoginForm({
  error,
  login,
  onChange,
  onSubmit,
}: {
  error: string;
  login: Login;
  onChange: (login: Login) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <main className={styles.shell}>
      <form className={styles.card} onSubmit={onSubmit}>
        {error && <p className={styles.error}>{error}</p>}
        <label>
          Username
          <input
            value={login.username}
            onChange={(event) =>
              onChange({ ...login, username: event.target.value })
            }
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={login.password}
            onChange={(event) =>
              onChange({ ...login, password: event.target.value })
            }
            autoComplete="current-password"
            required
          />
        </label>
        <button className={styles.primary} type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
