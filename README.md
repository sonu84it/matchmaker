# PairMuse AI (Prototype)

PairMuse AI is a lightweight matchmaking demo built on a Google Cloud-first stack. A visitor uploads one portrait, the app analyzes the visible fashion and scene cues once, then can generate fictional AI partner portraits one at a time across three directions: Similar, Complementary, and Dream. There is no authentication, no profile setup, and no prompt box.

## Project Structure

```text
.
├── app
│   ├── api
│   │   ├── analyze/route.ts
│   │   ├── generate/route.ts
│   │   ├── generate-couple/route.ts
│   │   ├── session/route.ts
│   │   └── upload/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── ImageCard.tsx
│   ├── ProgressLoader.tsx
│   ├── ResultGrid.tsx
│   ├── SceneSelector.tsx
│   ├── Toast.tsx
│   └── UploadDropzone.tsx
├── lib
│   ├── ai
│   │   ├── analyze.ts
│   │   ├── generate.ts
│   │   ├── prompt-builder.ts
│   │   └── vertex.ts
│   ├── config.ts
│   ├── data-store.ts
│   ├── gcs.ts
│   ├── session.ts
│   ├── types.ts
│   └── utils.ts
├── Dockerfile
├── cloudbuild.yaml
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Features

- No authentication. Anonymous `sessionId` stored in `localStorage`.
- Quota-aware flow: upload, analyze once, generate partner directions one at a time, optionally create a couple portrait.
- Usage cap of 5 generations per browser session, enforced on client and server.
- Optional Firestore-backed session and generation metadata for better multi-instance Cloud Run behavior.
- Google Cloud Storage for uploaded and generated images.
- Vertex AI for structured image analysis and photorealistic image generation.
- Dark, mobile-first UI with a more premium studio-style presentation and results flow.

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
GCP_PROJECT_ID=your-project-id
GCS_BUCKET=your-gcs-bucket
VERTEX_LOCATION=us-central1
VERTEX_MODEL_ANALYSIS=gemini-2.5-flash
VERTEX_MODEL_IMAGE=imagen-3.0-generate-002
FIRESTORE_ENABLED=false
FIRESTORE_COLLECTION_PREFIX=pairmuse
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The server must run with Google Cloud credentials that can access Vertex AI and the configured GCS bucket. For local development, `GOOGLE_APPLICATION_CREDENTIALS` can point to a service account JSON key.

Set `FIRESTORE_ENABLED=true` to persist anonymous session usage, upload metadata, and generation records in Firestore. This is recommended for Cloud Run deployments with multiple instances.

## Local Run

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` and fill in the environment variables.

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Deployment Steps

1. Enable required APIs:

```bash
gcloud services enable run.googleapis.com aiplatform.googleapis.com cloudbuild.googleapis.com storage.googleapis.com firestore.googleapis.com
```

2. Create a GCS bucket:

```bash
gcloud storage buckets create gs://YOUR_BUCKET --location=us-central1
```

3. Build container image with Cloud Build:

```bash
gcloud builds submit --config cloudbuild.yaml --substitutions _IMAGE=us-central1-docker.pkg.dev/YOUR_PROJECT/pairmuse/pairmuse-ai:latest
```

4. Deploy to Cloud Run:

```bash
gcloud run deploy pairmuse-ai \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT/pairmuse/pairmuse-ai:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT,GCS_BUCKET=YOUR_BUCKET,VERTEX_LOCATION=us-central1,VERTEX_MODEL_ANALYSIS=gemini-2.5-flash,VERTEX_MODEL_IMAGE=imagen-3.0-generate-002,FIRESTORE_ENABLED=true,FIRESTORE_COLLECTION_PREFIX=pairmuse
```

5. Grant the Cloud Run service account permissions:

- `Vertex AI User`
- `Storage Object Admin` or a tighter scoped write/read role on the bucket
- `Cloud Datastore User` if `FIRESTORE_ENABLED=true`

6. Optional hardening:

- Move env vars to Secret Manager and mount them at deploy time.
- Add a lifecycle rule to auto-delete `uploads/` and `generated/` objects after 1-7 days.

## Storage Layout

```text
uploads/{sessionId}/{uploadId}.jpg
generated/{sessionId}/{generationId}.png
```

Images are exposed to the client through signed read URLs. The app does not promise long-term storage and is intended for temporary demo usage.

## API Summary

- `POST /api/upload`
  - Accepts a multipart image upload, validates size/type, stores it in GCS, returns `uploadId`.
- `GET /api/session`
  - Returns current anonymous session usage and remaining generations.
- `POST /api/analyze`
  - Uses Vertex Gemini multimodal analysis and returns a normalized style profile.
- `POST /api/generate`
  - Generates one partner portrait per request for `similar`, `complementary`, or `dream`.
- `POST /api/generate-couple`
  - Generates one fictional couple portrait from the selected match and preset scene.

## MVP Limitations

- Firestore persistence is optional. If `FIRESTORE_ENABLED=false`, usage and metadata fall back to in-memory storage and can reset on restart or horizontal scale-out.
- The UI is intentionally tuned for limited Imagen quota, so partner directions are generated individually rather than in a batch of three.
- Couple generation is prompt-driven and style-based. It does not reliably preserve the real uploaded face.
- Face validation relies on Gemini analysis, not a dedicated face detection pipeline.
- This prototype is optimized for demo speed rather than production abuse protection.
- Cleanup is not automatic in code; use GCS lifecycle rules for temporary data retention.
