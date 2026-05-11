# CSV Dashboard Analyzer

CSV Dashboard Analyzer is a React + TypeScript web app that turns any CSV file into an automatic analytics dashboard. It profiles columns, detects data types, recommends charts, generates insight summaries, supports filtering, and exports the dashboard as a PDF.

## Features

- CSV upload and parsing with Papa Parse
- Automatic schema detection for numbers, dates, booleans, common text, text, and empty columns
- Mathematically correct profiling formulas for mean, median, quartiles, variance, standard deviation, completeness, frequency, and share
- 40-rule chart recommendation catalog
- Auto-generated Recharts visualizations
- AI-style insight summary from the uploaded data
- Global search, category, numeric range, and date range filters
- PDF export using html2canvas and jsPDF
- Responsive dashboard UI

## Tech Stack

- React
- TypeScript
- Vite
- Recharts
- Papa Parse
- html2canvas
- jsPDF
- Lucide React

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Build

```bash
npm run build
```

## Deploy

This repo includes a GitHub Actions workflow that builds the app and deploys `dist` to GitHub Pages whenever changes are pushed to `main`.

After the first push, enable GitHub Pages:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Pages`.
3. Under `Build and deployment`, select `GitHub Actions`.
4. Wait for the `Deploy to GitHub Pages` workflow to finish.

The site will be available at:

```text
https://code-with-ganesh.github.io/CSV-Dashboard-Analyzer/
```
