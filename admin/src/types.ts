export type Annotation = {
  id: string;
  deviceName: string | null;
  smellWalkId: string | null;
  title: string;
  note: string;
  sensorReadings: Record<string, number | null>;
  latitude: number | null;
  longitude: number | null;
  photo: string | null;
  audio: string | null;
  timestamp: string;
  installationId: string | null;
};

export type Filters = {
  title: string;
  annotationId: string;
  note: string;
  deviceName: string;
  smellWalkId: string;
  dateFrom: string;
  dateTo: string;
  media: string;
};

export const emptyFilters: Filters = {
  title: "",
  annotationId: "",
  note: "",
  deviceName: "",
  smellWalkId: "",
  dateFrom: "",
  dateTo: "",
  media: "",
};
