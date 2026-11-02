import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { request } from "../api";
import { Annotation, emptyFilters, Filters } from "../types";
import { AnnotationCard } from "./AnnotationCard";
import { Header } from "./Header";
import { LoginForm } from "./LoginForm";
import { FiltersForm } from "./FiltersForm";
import styles from "./App.module.css";

export function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [filters, setFilters] = useState(emptyFilters);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadAnnotations = useCallback(async (activeFilters: Filters) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const response = await request(`/admin/api/annotations?${params}`);
      const data = (await response.json()) as { annotations: Annotation[] };
      setAnnotations(data.annotations);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    request("/admin/api/session")
      .then(async (response) => {
        const session = (await response.json()) as {
          configured: boolean;
          authenticated: boolean;
        };
        if (!session.configured) throw new Error("Admin is not configured.");
        setAuthenticated(session.authenticated);
        if (session.authenticated) loadAnnotations(emptyFilters);
      })
      .catch((sessionError) => {
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Unable to connect",
        );
        setAuthenticated(false);
      });
  }, [loadAnnotations]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await request("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      setAuthenticated(true);
      setLogin({ username: "", password: "" });
      loadAnnotations(emptyFilters);
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Sign-in failed",
      );
    }
  };

  const signOut = async () => {
    await request("/admin/api/logout", { method: "POST" });
    setAuthenticated(false);
    setAnnotations([]);
  };

  if (authenticated === null) {
    return <div className={styles.center}>Loading…</div>;
  }
  if (!authenticated) {
    return (
      <LoginForm
        error={error}
        login={login}
        onChange={setLogin}
        onSubmit={signIn}
      />
    );
  }

  return (
    <main className={styles.page}>
      <Header onSignOut={signOut} />
      <div className={styles.content}>
        <FiltersForm
          filters={filters}
          onChange={setFilters}
          onClear={() => {
            setFilters(emptyFilters);
            loadAnnotations(emptyFilters);
          }}
          onSubmit={() => loadAnnotations(filters)}
        />
        <p className={styles.resultCount}>
          {loading
            ? "Loading…"
            : `${annotations.length} matching fingerprint${annotations.length === 1 ? "" : "s"}`}
        </p>
        {error && <p className={styles.error}>{error}</p>}
        {annotations.map((annotation) => (
          <AnnotationCard
            key={annotation.id}
            annotation={annotation}
            onDelete={async () => {
              if (
                !window.confirm(
                  "Delete this fingerprint and its R2 media? This cannot be undone.",
                )
              )
                return;
              await request(
                `/admin/api/annotations/${encodeURIComponent(annotation.id)}/delete`,
                { method: "POST" },
              );
              loadAnnotations(filters);
            }}
          />
        ))}
        {!loading && annotations.length === 0 && (
          <div className={styles.empty}>No fingerprints found.</div>
        )}
      </div>
    </main>
  );
}
