# Lawyer-App (Genie Law)

## Repository layout

- `backend/`: the API server (Node.js, Express, Mongoose, Socket.IO)
- `Frontend/`: React Native app (also builds for the web)
- `GenieLaw-Admin/`: Next.js admin panel

## Production architecture

```
React Native app / web / admin
            │  HTTPS + WebSocket (Socket.IO)
            ▼
   Render web service (backend/)
       │                 │
       ▼                 ▼
 MongoDB Atlas      Cloudflare R2 (private bucket)
 application data   uploaded files (documents, images, audio)
 + file metadata
```

MongoDB Compass is only a tool for inspecting the Atlas database.
All configuration comes from environment variables: `backend/.env` locally, the service's environment variables on Render (names listed in `render.yaml`).

- Deploy: `render.yaml` (Render Blueprint) and `docs/RENDER_MIGRATION.md`
- Local development: local MongoDB (`mongodb://127.0.0.1:27017/genielaw`, viewable in
  MongoDB Compass) + local R2 (`FILE_STORAGE=local`, viewable in Cloudflare's Local
  Explorer at http://127.0.0.1:8787/cdn-cgi/local/explorer); `cd backend && npm install && npm run dev`.
  Before deploying, switch to `FILE_STORAGE=r2` with the R2 credentials and an Atlas `MONGODB_URI`.
