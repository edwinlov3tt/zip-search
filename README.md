# Zip Search

A React-based geographic search application that allows users to search for ZIP codes, cities, and counties with radius-based and hierarchical search capabilities.

## Features

- **Radius Search**: Find ZIP codes within a specified radius from any location
- **Hierarchical Search**: Search by State → County → City
- **Multiple Search Management**: Maintain multiple active searches on the map simultaneously
- **Interactive Map**: View search results with markers, radius circles, and ZIP boundaries
- **Data Export**: Export results to CSV or copy to clipboard
- **Search History**: Track and manage multiple searches with individual display settings

## Local Development

### Quick Start

```bash
# Install dependencies
npm install

# Run both Vite frontend and API server concurrently
npm run dev:all
```

### Running Servers Separately

```bash
# Terminal 1: Run API server (port 3001)
npm run dev:api

# Terminal 2: Run Vite frontend (port 5173)
npm run dev
```

The API server will run at `http://localhost:3001` and serve the Edge Functions locally.
The frontend will run at `http://localhost:5173` and connect to the local API.

### Environment Setup

The application uses two environment files:
- `.env` - Production environment variables
- `.env.local` - Local development overrides (automatically loaded)

The local API server requires non-VITE prefixed environment variables for Edge Functions.

## Available Scripts

- `npm run dev` - Start Vite development server
- `npm run dev:api` - Start local API development server
- `npm run dev:all` - Run both servers concurrently
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint checks

## Tech Stack

- **Frontend**: React 19, Vite 7
- **Maps**: Leaflet, React-Leaflet
- **Styling**: Tailwind CSS 4
- **Backend**: Vercel Edge Functions (served locally via Express for development)
- **Database**: Supabase
- **Icons**: Lucide React

## Project Structure

```
zip-search/
├── api/                  # Vercel Edge Functions
│   └── v1/              # API v1 endpoints
├── src/
│   ├── components/      # React components
│   ├── contexts/        # React Context providers
│   ├── services/        # API services
│   └── utils/          # Utility functions
├── api-dev-server.js    # Local API development server
└── .env.local          # Local environment variables
```