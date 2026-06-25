# SOS La Guaira

Plataforma web de **rescate y reunificación** tras terremotos en La Guaira (Vargas, Venezuela).
La gente reporta personas desaparecidas, personas a salvo, personas **atrapadas** (rescate urgente)
y el estado de edificios, todo sobre un mapa. El sistema hace _match_ entre "busco" y "a salvo".

- **Sin login** (cero fricción), mobile-first, pensado para conectividad mala.
- **Frontend:** React + Vite + TailwindCSS + react-leaflet (OpenStreetMap, sin API key).
- **Backend:** Node + Express + PostgreSQL (helmet, CORS, rate limiting, multer para fotos).

---

## Estructura

```
.
├── frontend/        SPA (Vite). Build estático en frontend/dist
├── backend/         API Express + PostgreSQL + uploads
├── seed_data_laguaira.json   datos semilla de las zonas de La Guaira
└── levantar_todo.bat         arranque local (Windows): backend + frontend + navegador
```

---

## Desarrollo local

Requisitos: Node 18+, PostgreSQL 14+.

```bash
# 1) Backend
cd backend
cp .env.example .env        # ajusta DB_* y CORS_ORIGIN
npm install
npm run migrate             # crea las tablas
npm run seed                # carga datos semilla (opcional)
npm run dev                 # http://localhost:3000

# 2) Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

En desarrollo el frontend NO necesita `.env`: el proxy de Vite redirige `/api` y `/uploads`
a `http://localhost:3000` (ver `frontend/vite.config.js`). En Windows puedes usar
`levantar_todo.bat` para arrancar todo de un click.

---

## Despliegue — Railway + GitHub

Arquitectura objetivo:

| Pieza      | Hosting                         | Notas                                          |
|------------|---------------------------------|------------------------------------------------|
| Backend    | Railway (servicio Node)         | despliega desde GitHub, root dir = `backend`   |
| PostgreSQL | Railway (plugin Postgres)       | base de datos administrada, red privada        |
| Frontend   | Railway static **o** Vercel     | build de Vite, apunta al backend vía env var   |

### Paso a paso

1. **Subir el repo a GitHub** (ver "Lo que falta" abajo: requiere credenciales de David).

2. **Railway → New Project → Deploy from GitHub repo** y selecciona el repo.

3. **Backend (servicio Node):**
   - *Root Directory:* `backend`
   - *Build Command:* `npm install`
   - *Start Command:* `npm run migrate && npm start`
     (las migraciones son idempotentes; corren en cada arranque sin romper datos).
   - El **seed** se corre una sola vez de forma manual: `railway run npm run seed`
     (NO ponerlo en el start para no duplicar datos).

4. **PostgreSQL:** *New → Database → Add PostgreSQL*. En el servicio backend define
   estas variables **referenciando el plugin** (no copies valores):

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   CORS_ORIGIN=https://<DOMINIO-DEL-FRONTEND>
   MAX_UPLOAD_MB=5
   ```

   > `PORT` lo inyecta Railway automáticamente; `server.js` ya usa `process.env.PORT`.
   > `backend/db.js` usa `DATABASE_URL` con **SSL** en producción y cae a las variables
   > `DB_*` en desarrollo local. Railway entrega `DATABASE_URL` lista para usar.
   >
   > **SSL:** con la URL **pública** (proxy de Railway) el SSL va activo, no toques nada.
   > Si usas la URL **interna/privada** (`*.railway.internal`, misma red, recomendada),
   > esa red no usa SSL → añade `DB_SSL=false` para evitar fallos de conexión.

5. **Volume para fotos (obligatorio):** en el servicio backend, *Settings → Volumes →
   añade un Volume montado en* `backend/uploads` (ruta `/app/uploads`). Sin esto, el FS
   efímero de Railway borra las fotos en cada redeploy y se cae el feature de mostrarlas.

6. **Frontend:**
   - *Root Directory:* `frontend`
   - *Build Command:* `npm install && npm run build` → genera `frontend/dist`
   - Servir `dist` como estático (Railway static site o Vercel).
   - Variable de entorno de build:
     ```
     VITE_API_URL=https://<DOMINIO-DEL-BACKEND>.up.railway.app
     ```
     (origen del backend, **sin** `/api`). Si cambia, reconstruir el frontend.

7. **Cerrar el círculo de CORS:** una vez conoces el dominio del frontend, ponlo en
   `CORS_ORIGIN` del backend y redepliega.

---

## Variables de entorno

**Backend** (`backend/.env`, ver `backend/.env.example`):
`PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `CORS_ORIGIN`, `MAX_UPLOAD_MB`.

**Frontend** (`frontend/.env`, ver `frontend/.env.example`):
`VITE_API_URL` — origen del backend en producción; vacío en desarrollo (usa el proxy de Vite).

---

## Notas de seguridad del repo

`.gitignore` excluye: `node_modules/`, `**/.env` (secretos), `dist/`, `backend/uploads/*`,
y los archivos internos de coordinación (`CLAUDE.md`, `proyecto.md`). **No subir** credenciales
ni `.env` reales.
