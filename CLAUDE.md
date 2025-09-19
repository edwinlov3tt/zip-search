# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based geographic search application built with Vite that allows users to search for ZIP codes, cities, and counties with radius-based and hierarchical search capabilities. The application features a map view and results drawer for displaying search data.

## Development Commands

### Core Commands
```bash
npm run dev        # Start Vite dev server on http://localhost:5173
npm run build      # Build for production (outputs to dist/)
npm run preview    # Preview production build locally
npm run lint       # Run ESLint checks
```

### Quick Start
```bash
npm install        # Install all dependencies
npm run dev        # Start development server
```

## Architecture & Key Components

### Technology Stack
- **Build Tool**: Vite (v7.1.2) - Fast build tool with HMR
- **Framework**: React 19.1.1
- **Styling**: Tailwind CSS v4.1.13 (needs configuration)
- **Icons**: Lucide React (v0.544.0)
- **Linting**: ESLint 9 with React-specific rules

### Main Application Structure
- **Entry Point**: `src/main.jsx` - Mounts React app to DOM
- **App Component**: `src/App.jsx` - Main app wrapper
- **GeoApplication**: `src/GeoApplication.jsx` - Complete geographic search interface (28KB component)

### GeoApplication Component Features
The `GeoApplication.jsx` component implements:
- **Dual Search Modes**: Radius-based and hierarchical state/county/city searches
- **Data Views**: ZIP codes, cities, and counties with sortable tables
- **Interactive Map**: Street/satellite/terrain views with drawing tools
- **Results Management**: Export to CSV, copy to clipboard, state filtering
- **Resizable Drawer**: Adjustable results panel with tabs for different data types

## Missing Configuration

### Tailwind CSS Setup Required
The project has Tailwind CSS installed but needs configuration:
1. Create `tailwind.config.js`
2. Create `postcss.config.js`
3. Update `src/index.css` with Tailwind directives

## Current State

The application currently:
- Has the default Vite React template in `src/App.jsx`
- Contains a complete GeoApplication component ready to use
- Has dependencies installed (Tailwind, Lucide React)
- Needs Tailwind configuration files created
- Needs `App.jsx` updated to use GeoApplication component

## Integration Steps

To get the GeoApplication running:
1. Configure Tailwind CSS (create config files)
2. Update `src/index.css` with Tailwind directives
3. Modify `src/App.jsx` to import and use GeoApplication
4. Run `npm run dev` to start the development server