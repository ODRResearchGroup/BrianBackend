# BrianBackend

Small media upload API for BrianReactNative. It compresses annotation media before storing it in Cloudflare R2.

## Setup

1. Install Node.js 20+ and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`, `JWT_SECRET`, `BACKEND_PUBLIC_URL`, the InfluxDB
   credentials, and the R2 S3 API credentials.
4. Create an R2 bucket named `brian-media` (or set `R2_BUCKET_NAME`).
5. Run `npm run db:migrate`, `npm run admin:build`, `npm run build`, and `npm start`.

Before testing media uploads, verify R2 access with `npm run r2:check`. In
Cloudflare, create an **R2 API token** (not a general Cloudflare API token)
with **Object Read & Write** permissions scoped to the `brian-media` bucket.
Copy its S3 Access Key ID and Secret Access Key into `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY`. The endpoint must use the same Cloudflare account ID
as that token:
`https://<account-id>.r2.cloudflarestorage.com`.

The R2 token only needs `Object Read & Write` for the configured bucket. The bucket remains private. `BACKEND_PUBLIC_URL` is the address used to build protected media links stored in PostgreSQL.

The backend validates JWTs but does not store user IDs or use them in R2 paths.
Stored media links point back to the authenticated backend. The backend creates
a five-minute R2 signed URL only after validating the request JWT.

## Admin media browser

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`, then open
`<BACKEND_PUBLIC_URL>/admin` in a browser. The admin session uses an HttpOnly
cookie and lists private R2 objects with five-minute signed URLs. The mobile
JWT and the admin browser session are separate authentication mechanisms.

The admin UI is a Vite React app in `admin/`. Use `npm --prefix admin run dev`
for frontend development; its `/admin/api` requests proxy to the backend on
port 3001. In Vercel, the admin UI is deployed as the separate `admin`
service, while `/admin/api` is routed to the `api` service.
The admin service explicitly publishes its Vite output from `admin/dist`.
The admin build places its output under `dist/admin` so the service's original
`/admin` request path maps directly to the generated `index.html`.

## Vercel deployment

This project includes a Vercel serverless entrypoint in `api/index.ts` and
`vercel.json`. Import the repository into Vercel with the repository root as
the project root. Vercel builds the API and admin services independently: the
API service runs `npm run vercel-build`, while the admin service runs its Vite
build. Configure every
variable from `.env.example` in the Vercel project settings, including
`DATABASE_URL`, `JWT_SECRET`, the admin credentials, and the R2 credentials.
Set `BACKEND_PUBLIC_URL` to the deployed Vercel URL, for example
`https://brian-backend.vercel.app`, and set the same URL in the React Native
app's `BRIAN_BACKEND_URL`.

The deployed URLs are:

- API: `https://your-project.vercel.app/api/...`
- Admin: `https://your-project.vercel.app/admin`
- Root: redirects to `/admin`

The mobile API keeps InfluxDB credentials server-side. React Native clients
authenticate with a short-lived app session from `POST /api/session`.

Vercel functions are not persistent servers. The local `npm run dev:all`
workflow remains for development, while Vercel invokes the API function per
request. Media uploads still use private R2, but the 50 MB upload limit and
audio conversion can exceed Vercel limits for large or slow files. If that
happens, use a persistent Node host for the media endpoint.

## Upload API

`POST /api/annotations/:annotationId/media`

- Authentication: `Authorization: Bearer <JWT>`.

- Body: `multipart/form-data` with one file in the `media` field.
- Maximum input size: 50 MB.
- Supported input types: JPEG, PNG, WebP, HEIC, AAC, M4A/MP4, MP3, OGG, WAV, and WebM audio.

Images are auto-rotated, resized to fit within 2048x2048, and encoded as WebP at quality 82. Audio is converted to mono 44.1 kHz AAC at 64 kbps in an M4A container, which is suitable for voice notes while remaining small.

Example response:

```json
{
  "key": "images/annotation-id/uuid.webp",
  "url": "http://localhost:3001/api/media?key=images%2Fannotation-id%2Fuuid.webp",
  "contentType": "image/webp",
  "byteSize": 123456,
  "originalByteSize": 987654
}
```

In React Native, upload the local URI as multipart data:

```ts
const form = new FormData();
form.append("media", {
  uri: localUri,
  name: "annotation-media",
  type: mimeType,
} as unknown as Blob);

await fetch(`${API_BASE_URL}/api/annotations/${annotationId}/media`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

Do not set `Content-Type` manually; React Native adds the multipart boundary.

## Saving fingerprints

`POST /api/annotations`

- Body: JSON containing the fingerprint fields below.
- `recordingId` is the stable idempotency key and becomes the PostgreSQL annotation id.
- `photo` and `audio` contain the direct URLs returned by the R2 upload flow.

The endpoint stores sensor readings, timestamp, float coordinates, title, note, photo/audio links, device name, and smell-walk id directly in `annotations`. Repeating the request updates the fingerprint, so mobile retrying is safe.

Example:

```json
{
  "recordingId": "capture-uuid",
  "sensorReadings": {
    "CH4": 0.21,
    "CO": 0.08,
    "Temperature": 22.4,
    "Humidity": 48.1
  },
  "title": "Wet earth",
  "note": "Near the path after rain",
  "timestamp": "2026-11-01T17:54:55.279Z",
  "latitude": 55.7047,
  "longitude": 13.191,
  "photo": "http://localhost:3001/api/media?key=images%2Fcapture-uuid%2Ffile.webp",
  "audio": "http://localhost:3001/api/media?key=audio%2Fcapture-uuid%2Ffile.m4a",
  "deviceName": "Brian-ABC123",
  "smellWalkId": "walk-uuid"
}
```
