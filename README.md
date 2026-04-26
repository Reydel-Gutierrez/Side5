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

- `GET /api/health` -> `{ "status": "ok", "app": "Side5 API" }`
- `GET /api/leagues` -> placeholder response
- `GET /api/sessions` -> placeholder response
- `GET /api/players` -> placeholder response

## Notes

- UI follows a premium dark-mode sports app style.
- Home screen, bottom navigation, themed cards, and placeholder pages are ready.
- Backend is prepared as a clean skeleton for next features (leagues, sessions, players, draft logic, and stats).
