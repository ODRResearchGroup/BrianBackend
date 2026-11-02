CREATE TABLE "annotations" (
    "id" TEXT NOT NULL,
    "deviceName" TEXT,
    "smellWalkId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "sensorReadings" JSONB NOT NULL DEFAULT '{}',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photo" TEXT,
    "audio" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "annotations_timestamp_idx" ON "annotations"("timestamp");
CREATE INDEX "annotations_smellWalkId_idx" ON "annotations"("smellWalkId");
