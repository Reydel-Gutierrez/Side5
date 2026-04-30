# Side5

Draft your side. Run the game.

Mobile-first pickup league manager built with React + Node/Express.

## Stack

- Client: React, React Router, plain CSS (mobile-first)
- Server: Node.js, Express, CORS, dotenv, morgan, helmet

## Project Structure

```
side5/
  client/
  server/
  README.md
```

## Run Locally

### 1) Client

```bash
cd client
npm install
npm run dev
```

Client runs at `http://localhost:5173`.

### 2) Server

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:5000`.

## API Endpoints (Current)

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/leagues`
- `GET /api/leagues/:id`
- `POST /api/leagues`
- `POST /api/leagues/join`
- `GET /api/leagues/:id/members`
- `PATCH /api/leagues/:leagueId/members/:userId/role`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions`
- `POST /api/sessions/:id/confirm`
- `GET /api/players`
- `GET /api/players/:id`
- `POST /api/matches/:matchId/stats`
- `GET /api/matches/:matchId/stats/pending`
- `PATCH /api/stats/:submissionId/approve`
- `PATCH /api/stats/:submissionId/deny`

## MySQL Setup

Create database:

```sql
CREATE DATABASE side5_db;
```

Run schema:

```bash
mysql -u root -p side5_db < server/src/db/schema.sql
```

Run seed:

```bash
mysql -u root -p side5_db < server/src/db/seed.sql
```

Run server:

```bash
cd server
npm run dev
```

## Notes

- UI follows a premium dark-mode sports app style.
- Home screen, bottom navigation, themed cards, and placeholder pages are ready.
- Backend is prepared as a clean skeleton for next features (leagues, sessions, players, draft logic, and stats).
