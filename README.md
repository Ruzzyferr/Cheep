# 🐦 Cheep — Intelligent Shopping Assistant

**A full-stack price comparison platform with LLM-powered product matching, route optimization, and cross-store analytics.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)

---

## Overview

Cheep is an end-to-end system that aggregates grocery prices from multiple retailers, uses **Large Language Models** to match equivalent products across different stores, and computes **optimal shopping routes** using combinatorial optimization. The architecture spans data ingestion, semantic product matching, REST APIs, and a cross-platform mobile app.

### The Problem

Retailers use different naming conventions, units, and categories for the same products. A "Pınar Süt 1L" at Migros might appear as "Pinar Tam Yagli Sut 1 Litre" at CarrefourSA. Manually matching thousands of SKUs is infeasible; naive string matching fails on typos, abbreviations, and language variations.

### The Solution

A **3-stage LLM pipeline** that normalizes product data, generates embeddings for cross-market matching, and consolidates categories—combined with a **7-factor scoring engine** and **TSP-based route optimization** to recommend the best stores and visit order for a given shopping list.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHEEP — Full-Stack System                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ Cheep-Scraper│───▶│ cheep-backend-express│◀──▶│   Cheep-Mobile       │  │
│  │   (Python)   │    │   (Node.js/Express)   │    │ (React Native/Expo)  │  │
│  └──────────────┘    └──────────────────────┘    └──────────────────────┘  │
│         │                         │                          │              │
│         │                         │                          │              │
│  • Multi-store scraping    • REST API (JWT auth)      • iOS / Android      │
│  • 3-stage LLM pipeline   • Prisma + PostgreSQL       • Secure token store │
│  • Embedding + cosine sim  • TSP route optimizer      • Compare engine UI   │
│  • Country-based config    • 7-factor scoring         • List management    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Highlights

### 1. **LLM-Powered Product Matching Pipeline**

A scalable 3-stage pipeline for matching products across retailers:

| Stage | Method | Purpose |
|-------|--------|---------|
| **Stage 1** | LLM batch processing (300 products/batch) | Market-level normalization, category assignment |
| **Stage 2** | Text embeddings + cosine similarity | Cross-market product matching |
| **Stage 3** | LLM verification | Category consolidation, conflict resolution |

- Supports **OpenAI** and **OpenRouter** (multi-model)
- Cost-efficient: ~$8 for 16K products (Stage 1: LLM, Stage 2: embeddings ~$0.02)
- Configurable models: GPT-4o-mini, Claude, Gemini

### 2. **Route Optimization (TSP)**

The compare engine solves a **Traveling Salesman Problem** variant to minimize travel cost while maximizing savings:

- **7-factor scoring**: total price (30%), store count (15%), distance (20%), route efficiency (15%), favorite store bonus (10%), missing products penalty (-10%), budget compliance (10%)
- User-configurable favorite stores and budget constraints
- Outputs optimal store visit order and estimated savings

### 3. **Fuzzy Product Matching**

Backend product matcher uses:

- **Levenshtein distance** for typo tolerance
- **Jaccard similarity** for set-based comparison
- **Fingerprint generation** for deduplication
- Turkish character normalization
- ~95%+ accuracy on real-world data

### 4. **Multi-Store Data Ingestion**

- **Modular scrapers**: Migros, CarrefourSA, A101, ŞOK (Turkey)
- **Country-based config**: add new markets without code changes
- **Bulk import API**: 1000 products per request with LLM-assisted matching

---

## Project Structure

| Module | Stack | Description |
|--------|-------|-------------|
| **Cheep-Scraper** | Python, OpenAI/OpenRouter | Web scraping, 3-stage LLM pipeline, embedding-based matching |
| **cheep-backend-express** | Node.js, Express, TypeScript, Prisma, PostgreSQL | REST API, auth, compare engine, route optimizer |
| **Cheep-Mobile** | React Native, Expo | Cross-platform app with JWT auth, lists, compare UI |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

### Backend

```bash
cd cheep-backend-express
cp .env.example .env   # Set DATABASE_URL, JWT_SECRET
pnpm install
npx prisma migrate dev
pnpm run seed
pnpm dev
```

### Scraper

```bash
cd Cheep-Scraper
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env    # Set OPENAI_API_KEY or OPENROUTER_API_KEY
```

### Mobile

```bash
cd Cheep-Mobile
npm install
npx expo start
```

---

## API Documentation

- **Swagger UI**: `http://localhost:3000/api-docs`
- **Base URL**: `http://localhost:3000/api/v1`

Key endpoints: auth, products (CRUD + compare), stores, lists (with compare), store-prices (bulk import), feedback.

---

## Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Scraper** | Python, requests, OpenAI API, text-embedding-3-small |
| **Backend** | Express.js, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Joi, Winston |
| **Mobile** | React Native, Expo, React Navigation, Axios, SecureStore |
| **LLM** | OpenAI GPT-4o-mini, OpenRouter (multi-provider) |

---

## License

MIT
