import styles from "./FilterField.module.css";

export function FilterField({
  label,
  type = "search",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
