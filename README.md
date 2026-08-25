<p align="center">
  <img src="./frontend/public/favicon.webp" width="96" alt="Joule: Zero Point Logo" />
</p>

<h1 align="center">JOULE: ZERO POINT</h1>

<p align="center">
  <strong>"In the Zero Point, time is a weapon. Master the energy, shape reality."</strong><br />
  <em>A Cyberpunk Strategic Card Game with Advanced LLM Integration.</em>
</p>

<p align="center">
  <a href="https://www.joulezeropoint.com/">
    <img src="https://img.shields.io/badge/🌐_Live-joulezeropoint.com-00f2ff?style=for-the-badge&labelColor=0a0e1a" alt="Live Site" />
  </a>
  <a href="https://discord.gg/csXJz6zB">
    <img src="https://img.shields.io/badge/💬_Discord-Join_Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" />
  </a>
  <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3673801132">
    <img src="https://img.shields.io/badge/🎮_Play_on_TTS-Steam_Workshop-171a21?style=for-the-badge&logo=steam&logoColor=white" alt="Steam Workshop" />
  </a>
  <img src="https://github.com/Galdrial/JouleZeroPointWeb/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue_3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Anthropic-D4A27F?style=flat-square&logo=anthropic&logoColor=white" alt="Anthropic" />
  <img src="https://img.shields.io/badge/License-UNLICENSED-red.svg?style=flat-square" alt="License" />
</p>

---

## 🌌 Overview

**Joule: Zero Point** is more than a card game — it's an immersive cyberpunk experience where the laws of physics have collapsed. Each player takes on the role of a **Constructor**, manipulating the flow of time across three distinct zones: **Past, Present, and Future**.

The beating heart of the project is the **Zero Point Terminal**, an AI-powered neural interface that assists players with lore retrieval, card statistics, and real-time rule arbitration — all while staying fully in-character.

---

## 📘 Technical Documentation

For a comprehensive analysis of the system's architecture, security protocols, and engineering decisions, I have prepared a dedicated document:

👉 **[Technical Deep Dive (docs/TECHNICAL_DEEP_DIVE.md)](./docs/TECHNICAL_DEEP_DIVE.md)**

*Includes details on: SSoT with Google Sheets, AI Scudo Temporale (Safety Audit), NoSQL Sanitization, and PWA Caching Strategy.*

---

## 🖼️ Screenshots

### 🏠 Home — The Zero Point Atmosphere
![Home](./docs/screenshots/home.webp)

### 🖥️ Zero Point Terminal — AI Neural Interface
![Terminal](./docs/screenshots/terminal.webp)

### 🎴 Fragment Database — Card Discovery
![Database](./docs/screenshots/database.webp)

### 🛠️ Deckbuilder — Tactical Workshop
![Deckbuilder](./docs/screenshots/deckbuilder.webp)

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🖥️ **Zero Point Terminal** | LLM-driven AI referee that responds in-character to player queries |
| 🎴 **Fragment Database** | Full card library with advanced type/stat filters |
| 🛠️ **Deckbuilder** | Create, save, and share tactical decks with Constructor hero |
| 📜 **Rulebook & Lore** | Integrated Rulebook 5.0 and News/Lore communication hub |
| 🔐 **Identity System** | JWT auth, email verification, alias management, password recovery |
| 📤 **Deck Export** | Client-side generation of PDFs and TTS kits (no backend dependency) |

---

## 🚀 Quick Start with Docker (Recommended)

The entire ecosystem (Frontend, Backend, and local MongoDB) is orchestrated via Docker Compose for an instant setup.

```bash
git clone https://github.com/Galdrial/JouleZeroPointWeb.git
cd JouleZeroPointWeb
docker compose up --build
```
> [!TIP]
> The frontend will be available at `http://localhost:5174`. The backend will use your `.env` configuration.

### 🧪 Database Seeding (Mandatory)
After the containers are up, you **must** populate the database with the card fragments:
```bash
docker exec -it joule-backend node scripts/seedCards.js
```

---

## 🛠️ Manual Installation (Non-Docker)

If you prefer to run the ecosystem without Docker, ensure you have **Node.js 24.x** with **npm 10+** and **MongoDB** installed.

### 1. Backend Setup
```bash
cd backend
npm install --legacy-peer-deps
cp .env.example .env  # Configure your MONGODB_URI
npm run build         # Required for seeding
node scripts/seedCards.js
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env  # Ensure VITE_API_URL=http://localhost:3000/api/v1
npm run dev
```

---

## 🧪 Tech Stack

### Frontend
- **Framework:** Vue 3 (Composition API) + TypeScript
- **Build Engine:** Vite
- **State Management:** Pinia
- **Styling:** Vanilla CSS — custom cyberpunk design system
- **Synthesis Engine:** jsPDF (PDF) & JSZip (TTS)

### Backend
- **Runtime:** Node.js & Express
- **Database:** MongoDB Atlas (Mongoose ODM)
- **AI Engine:** Anthropic SDK (Neural Terminal)
- **Security:** Helmet, Rate Limiter, CORS, NoSQL Injection Sanitizer
- **Infrastructure:** Docker & Docker Compose

---

## 🔐 Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the required values:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret key for signing JWTs |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key for the AI Terminal |
| `SMTP_HOST / USER / PASS` | SMTP credentials for transactional email |

---

## 🚢 Deployment

| Layer | Platform |
|---|---|
| Frontend | Hetzner via Coolify, same container as the API |
| Backend | Hetzner via Coolify (Falkenstein, Germany) |
| Database | MongoDB Atlas |
| News images | Docker volume `joule-news-images`, mounted at `/app/public/news` |

### News images

Images uploaded from the editorial dashboard are stored on this server and served
from `/news`, not from a third-party CDN: an external host would see the IP
address of every visitor reading an article.

They live in a Docker volume declared in `docker-compose.prod.yml`. Since no
backup runs on the host, the copies committed under `backend/public/news-seed/`
are the backup: at boot the server copies into the volume any file that is not
already there, never overwriting one that is. To remove an image for good,
delete it from the repository as well, or the next boot puts it back.

---

## 👤 Author & Legal

**Simone Camerano** — Design, Mechanics & Lead Development

> Joule: Zero Point is registered on the **Patamu Registry** (deposit #284864).
> © 2026 Simone Camerano. All Rights Reserved. Proprietary software.

---

<p align="center">
  <em>"Chaos is a weapon. Use it."</em>
</p>
