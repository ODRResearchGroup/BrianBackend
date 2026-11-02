import type { FormEvent } from "react";
import { Filters } from "../types";
import { FilterField } from "./FilterField";
import styles from "./FiltersForm.module.css";

export function FiltersForm({
  filters,
  onChange,
  onClear,
  onSubmit,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const update = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.heading}>
        <h2>Find fingerprints</h2>
      </div>
      <FilterField
        label="Name/title"
        value={filters.title}
        onChange={(value) => update("title", value)}
      />
      <FilterField
        label="Annotation ID"
        value={filters.annotationId}
        onChange={(value) => update("annotationId", value)}
      />
      <FilterField
        label="Note"
        value={filters.note}
        onChange={(value) => update("note", value)}
      />
      <FilterField
        label="Device"
        value={filters.deviceName}
        onChange={(value) => update("deviceName", value)}
      />
      <FilterField
        label="Smell walk"
        value={filters.smellWalkId}
        onChange={(value) => update("smellWalkId", value)}
      />
      <FilterField
        label="From"
        type="date"
        value={filters.dateFrom}
        onChange={(value) => update("dateFrom", value)}
      />
      <FilterField
        label="To"
        type="date"
        value={filters.dateTo}
        onChange={(value) => update("dateTo", value)}
      />
      <label className={styles.field}>
        Media
        <select
          value={filters.media}
          onChange={(event) => update("media", event.target.value)}
        >
          <option value="">All</option>
          <option value="photo">Photo</option>
          <option value="audio">Audio</option>
          <option value="none">No media</option>
        </select>
      </label>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit">
          Filter
        </button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </form>
  );
}
