import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BarChart3,
  CalendarDays,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Hash,
  Lightbulb,
  ListChecks,
  Table2,
  TextCursorInput,
  Upload,
} from 'lucide-react'
import './App.css'

type ColumnType = 'number' | 'date' | 'boolean' | 'commonText' | 'text' | 'empty'

type DataRow = Record<string, string>

type ColumnProfile = {
  name: string
  type: ColumnType
  confidence: number
  filled: number
  missing: number
  unique: number
  sample: string[]
  numeric?: NumericStats
  dates?: DateStats
  topValues?: { name: string; value: number }[]
}

type NumericStats = {
  count: number
  sum: number
  min: number
  max: number
  mean: number
  median: number
  q1: number
  q3: number
  variance: number
  stdDev: number
}

type DateStats = {
  count: number
  min: Date
  max: Date
}

type Analysis = {
  rows: DataRow[]
  columns: ColumnProfile[]
  metrics: {
    totalRows: number
    totalColumns: number
    completeness: number
    duplicateRows: number
  }
}

type FilterState = {
  search: string
  categories: Record<string, string>
  numbers: Record<string, { min: string; max: string }>
  dates: Record<string, { from: string; to: string }>
}

type Insight = {
  title: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type ChartKind =
  | 'barTop'
  | 'pieShare'
  | 'lineTrend'
  | 'areaTrend'
  | 'scatter'
  | 'histogram'
  | 'boxPlot'
  | 'numericBar'
  | 'stackedBar'
  | 'composedTrend'
  | 'radial'
  | 'dateVolume'

type ChartSpec = {
  id: string
  title: string
  subtitle: string
  kind: ChartKind
  score: number
  x?: string
  y?: string
  category?: string
  series?: string
}

const chartCatalog = [
  'top-category-bar',
  'top-category-horizontal-bar',
  'category-share-donut',
  'category-share-pie',
  'category-radial-share',
  'numeric-histogram',
  'numeric-density-proxy',
  'numeric-box-summary',
  'numeric-range-summary',
  'numeric-kpi-bar',
  'average-by-category',
  'sum-by-category',
  'count-by-category',
  'median-by-category',
  'date-row-volume',
  'date-cumulative-volume',
  'date-line-trend',
  'date-area-trend',
  'date-composed-trend',
  'date-moving-average',
  'number-vs-number-scatter',
  'number-vs-number-bubble',
  'category-stacked-bar',
  'category-clustered-bar',
  'two-category-heatmap',
  'top-bottom-ranking',
  'pareto-category',
  'missingness-bar',
  'completeness-by-column',
  'unique-values-bar',
  'text-cardinality-map',
  'boolean-split',
  'outlier-score-summary',
  'quartile-band',
  'monthly-seasonality',
  'weekday-pattern',
  'correlation-pair',
  'small-multiple-category',
  'distribution-by-category',
  'schema-quality-overview',
]

const palette = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#dc2626', '#4f46e5', '#65a30d']

function App() {
  const dashboardRef = useRef<HTMLElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [sourceRows, setSourceRows] = useState<DataRow[]>(sampleRows)
  const [filters, setFilters] = useState<FilterState>(() => emptyFilters())
  const [error, setError] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const baseAnalysis = useMemo(() => analyzeRows(sourceRows), [sourceRows])
  const filteredRows = useMemo(() => applyFilters(sourceRows, baseAnalysis.columns, filters), [sourceRows, baseAnalysis.columns, filters])
  const analysis = useMemo(() => analyzeRows(filteredRows, baseAnalysis.columns.map((column) => column.name)), [filteredRows, baseAnalysis.columns])
  const charts = useMemo(() => selectCharts(analysis), [analysis])
  const typedColumns = useMemo(() => groupColumnsByType(analysis.columns), [analysis.columns])
  const insights = useMemo(() => generateInsights(analysis, sourceRows.length), [analysis, sourceRows.length])
  const activeFilterCount = countActiveFilters(filters)

  function handleFile(file?: File) {
    if (!file) return
    setFileName(file.name)
    setError('')
    Papa.parse<DataRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const rows = result.data.filter((row) => Object.values(row).some((value) => String(value ?? '').trim()))
        if (!rows.length) {
          setError('No usable rows were found in this CSV.')
          return
        }
        setSourceRows(rows)
        setFilters(emptyFilters())
      },
      error: (parseError) => setError(parseError.message),
    })
  }

  async function exportPdf() {
    if (!dashboardRef.current) return
    setIsExporting(true)
    setError('')
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#f8fafc',
        scale: 1.35,
        useCORS: true,
      })
      const imageData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imageWidth = pageWidth
      const imageHeight = (canvas.height * imageWidth) / canvas.width
      let heightLeft = imageHeight
      let position = 0

      pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imageHeight
        pdf.addPage()
        pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`${fileName.replace(/\.csv$/i, '') || 'csv-dashboard'}-dashboard.pdf`)
    } catch {
      setError('PDF export failed. Try again after the dashboard finishes rendering.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="app-shell" ref={dashboardRef}>
      <section className="topbar">
        <div>
          <p className="eyebrow">CSV intelligence dashboard</p>
          <h1>Analyze any CSV and generate a dashboard automatically.</h1>
        </div>
        <div className="top-actions">
          <button className="export-button" onClick={exportPdf} disabled={isExporting}>
            <Download size={18} />
            <span>{isExporting ? 'Exporting' : 'Export PDF'}</span>
          </button>
          <label className="upload-button">
            <Upload size={18} />
            <span>{fileName || 'Upload CSV'}</span>
            <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="metric-grid">
        <Metric icon={<Database />} label="Rows" value={analysis.metrics.totalRows.toLocaleString()} />
        <Metric icon={<Table2 />} label="Columns" value={analysis.metrics.totalColumns.toString()} />
        <Metric icon={<ListChecks />} label="Completeness" value={`${analysis.metrics.completeness.toFixed(1)}%`} />
        <Metric icon={<BarChart3 />} label="Auto charts" value={charts.length.toString()} />
        <Metric icon={<Filter />} label="Filters" value={activeFilterCount.toString()} />
      </section>

      <section className="workspace">
        <aside className="side-panel">
          <div className="panel-title">
            <FileSpreadsheet size={18} />
            <span>Detected schema</span>
          </div>
          <div className="type-stack">
            <TypeGroup icon={<Hash />} label="Numbers" columns={typedColumns.number} />
            <TypeGroup icon={<CalendarDays />} label="Dates" columns={typedColumns.date} />
            <TypeGroup icon={<ListChecks />} label="Common text" columns={typedColumns.commonText} />
            <TypeGroup icon={<TextCursorInput />} label="Text" columns={typedColumns.text} />
          </div>
          <FilterPanel baseAnalysis={baseAnalysis} filters={filters} onChange={setFilters} onReset={() => setFilters(emptyFilters())} />
        </aside>

        <section className="main-panel">
          <section className="insight-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AI-style insight summary</p>
                <h2>What the data is saying</h2>
              </div>
              <span>{analysis.metrics.totalRows.toLocaleString()} of {sourceRows.length.toLocaleString()} rows in view</span>
            </div>
            <div className="insight-grid">
              {insights.map((insight) => (
                <article className={`insight-card ${insight.tone}`} key={`${insight.title}-${insight.detail}`}>
                  <Lightbulb size={18} />
                  <div>
                    <h3>{insight.title}</h3>
                    <p>{insight.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recommended views</p>
              <h2>Auto-selected charts</h2>
            </div>
            <span>{charts.length} charts selected from {chartCatalog.length} rules</span>
          </div>
          <div className="chart-grid">
            {charts.map((chart) => (
              <ChartCard key={chart.id} spec={chart} analysis={analysis} />
            ))}
          </div>
        </section>
      </section>

      <section className="columns-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Column profiling</p>
            <h2>Type inference and formulas</h2>
          </div>
        </div>
        <div className="profile-grid">
          {analysis.columns.map((column) => (
            <ColumnCard key={column.name} column={column} rows={analysis.rows.length} />
          ))}
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Data preview</p>
            <h2>First rows</h2>
          </div>
        </div>
        <DataPreview rows={analysis.rows.slice(0, 12)} columns={analysis.columns.map((column) => column.name)} />
      </section>
    </main>
  )
}

function analyzeRows(rows: DataRow[], fallbackColumns: string[] = []): Analysis {
  const columns = Object.keys(rows[0] ?? {})
  const effectiveColumns = columns.length ? columns : fallbackColumns
  const profiles = effectiveColumns.map((name) => profileColumn(name, rows))
  const totalCells = rows.length * Math.max(effectiveColumns.length, 1)
  const filledCells = profiles.reduce((sum, column) => sum + column.filled, 0)
  const serializedRows = rows.map((row) => JSON.stringify(effectiveColumns.map((column) => normalizeCell(row[column]))))

  return {
    rows,
    columns: profiles,
    metrics: {
      totalRows: rows.length,
      totalColumns: effectiveColumns.length,
      completeness: totalCells ? (filledCells / totalCells) * 100 : 0,
      duplicateRows: serializedRows.length - new Set(serializedRows).size,
    },
  }
}

function profileColumn(name: string, rows: DataRow[]): ColumnProfile {
  const values = rows.map((row) => normalizeCell(row[name]))
  const filledValues = values.filter(Boolean)
  const uniqueValues = new Set(filledValues)
  const numericValues = filledValues.map(parseNumber).filter(isFiniteNumber).sort((a, b) => a - b)
  const dateValues = filledValues.map(parseDate).filter((date): date is Date => Boolean(date))
  const booleanValues = filledValues.filter((value) => /^(true|false|yes|no|0|1)$/i.test(value))
  const topValues = countValues(filledValues).slice(0, 8)

  const numericRatio = ratio(numericValues.length, filledValues.length)
  const dateRatio = ratio(dateValues.length, filledValues.length)
  const booleanRatio = ratio(booleanValues.length, filledValues.length)
  const cardinalityRatio = ratio(uniqueValues.size, filledValues.length)
  const headerHint = inferHeaderHint(name)

  let type: ColumnType = 'text'
  let confidence = 0.45

  if (!filledValues.length) {
    type = 'empty'
    confidence = 1
  } else if (numericRatio >= 0.9 && headerHint !== 'date') {
    type = 'number'
    confidence = Math.min(0.99, numericRatio + 0.04)
  } else if (dateRatio >= 0.75 || headerHint === 'date') {
    type = 'date'
    confidence = Math.min(0.98, Math.max(dateRatio, headerHint === 'date' ? 0.82 : 0))
  } else if (booleanRatio >= 0.9 && uniqueValues.size <= 2) {
    type = 'boolean'
    confidence = Math.min(0.98, booleanRatio)
  } else if (uniqueValues.size <= 30 || cardinalityRatio <= 0.35 || headerHint === 'category') {
    type = 'commonText'
    confidence = Math.min(0.95, 1 - Math.min(cardinalityRatio, 0.8) + 0.25)
  }

  return {
    name,
    type,
    confidence,
    filled: filledValues.length,
    missing: values.length - filledValues.length,
    unique: uniqueValues.size,
    sample: Array.from(uniqueValues).slice(0, 4),
    numeric: numericValues.length ? getNumericStats(numericValues) : undefined,
    dates: dateValues.length ? getDateStats(dateValues) : undefined,
    topValues,
  }
}

function inferHeaderHint(header: string) {
  const normalized = header.toLowerCase()
  if (/(date|time|year|month|day|created|updated|dob)/.test(normalized)) return 'date'
  if (/(type|status|category|class|city|state|country|gender|segment|department)/.test(normalized)) return 'category'
  return 'unknown'
}

function selectCharts(analysis: Analysis): ChartSpec[] {
  const numbers = analysis.columns.filter((column) => column.type === 'number')
  const dates = analysis.columns.filter((column) => column.type === 'date')
  const categories = analysis.columns.filter((column) => ['commonText', 'boolean'].includes(column.type))
  const specs: ChartSpec[] = []

  categories.forEach((category) => {
    specs.push({
      id: `bar-${category.name}`,
      title: `Top ${category.name}`,
      subtitle: 'Frequency distribution using count per category',
      kind: 'barTop',
      category: category.name,
      score: 86 - Math.min(category.unique, 40),
    })
    specs.push({
      id: `pie-${category.name}`,
      title: `${category.name} share`,
      subtitle: 'Percent contribution of the most common groups',
      kind: 'pieShare',
      category: category.name,
      score: category.unique <= 8 ? 82 : 58,
    })
    specs.push({
      id: `radial-${category.name}`,
      title: `${category.name} radial share`,
      subtitle: 'Compact category share view',
      kind: 'radial',
      category: category.name,
      score: category.unique <= 6 ? 72 : 45,
    })
  })

  numbers.forEach((number) => {
    specs.push({
      id: `hist-${number.name}`,
      title: `${number.name} histogram`,
      subtitle: 'Binned numeric frequency using Sturges-style bins',
      kind: 'histogram',
      y: number.name,
      score: 88,
    })
    specs.push({
      id: `box-${number.name}`,
      title: `${number.name} distribution`,
      subtitle: 'Min, quartiles, median and max summary',
      kind: 'boxPlot',
      y: number.name,
      score: 76,
    })
    categories.slice(0, 4).forEach((category) => {
      specs.push({
        id: `avg-${number.name}-by-${category.name}`,
        title: `Average ${number.name} by ${category.name}`,
        subtitle: 'Grouped mean: sum(values) / count(values)',
        kind: 'numericBar',
        x: category.name,
        y: number.name,
        score: 91 - Math.min(category.unique, 25),
      })
    })
  })

  dates.forEach((date) => {
    specs.push({
      id: `volume-${date.name}`,
      title: `Rows over ${date.name}`,
      subtitle: 'Records grouped by calendar period',
      kind: 'dateVolume',
      x: date.name,
      score: 83,
    })
    numbers.slice(0, 4).forEach((number) => {
      specs.push({
        id: `line-${number.name}-over-${date.name}`,
        title: `${number.name} over ${date.name}`,
        subtitle: 'Time trend using average numeric value by period',
        kind: 'lineTrend',
        x: date.name,
        y: number.name,
        score: 94,
      })
      specs.push({
        id: `area-${number.name}-over-${date.name}`,
        title: `${number.name} area trend`,
        subtitle: 'Cumulative-looking trend emphasis by date',
        kind: 'areaTrend',
        x: date.name,
        y: number.name,
        score: 80,
      })
      specs.push({
        id: `composed-${number.name}-over-${date.name}`,
        title: `${number.name} trend and volume`,
        subtitle: 'Average value with row count in one view',
        kind: 'composedTrend',
        x: date.name,
        y: number.name,
        score: 89,
      })
    })
  })

  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      specs.push({
        id: `scatter-${numbers[i].name}-${numbers[j].name}`,
        title: `${numbers[i].name} vs ${numbers[j].name}`,
        subtitle: 'Correlation view using numeric pairs',
        kind: 'scatter',
        x: numbers[i].name,
        y: numbers[j].name,
        score: 84,
      })
    }
  }

  if (categories.length >= 2 && numbers.length) {
    specs.push({
      id: `stacked-${categories[0].name}-${categories[1].name}`,
      title: `${categories[1].name} inside ${categories[0].name}`,
      subtitle: 'Stacked count matrix across two categories',
      kind: 'stackedBar',
      x: categories[0].name,
      series: categories[1].name,
      score: 78,
    })
  }

  return specs
    .filter((spec) => spec.score > 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
}

function ChartCard({ spec, analysis }: { spec: ChartSpec; analysis: Analysis }) {
  const chart = renderChart(spec, analysis)
  return (
    <article className="chart-card">
      <div className="chart-header">
        <div>
          <h3>{spec.title}</h3>
          <p>{spec.subtitle}</p>
        </div>
        <span>{Math.round(spec.score)}</span>
      </div>
      <div className="chart-body">{chart}</div>
    </article>
  )
}

function renderChart(spec: ChartSpec, analysis: Analysis) {
  if (spec.kind === 'barTop' && spec.category) {
    const data = getCategoryCounts(analysis.rows, spec.category, 10)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill={palette[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'pieShare' && spec.category) {
    const data = getCategoryCounts(analysis.rows, spec.category, 7)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={2}>
            {data.map((_, index) => (
              <Cell key={index} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'radial' && spec.category) {
    const data = getCategoryCounts(analysis.rows, spec.category, 6).map((item, index) => ({
      ...item,
      fill: palette[index % palette.length],
    }))
    return (
      <ResponsiveContainer width="100%" height={250}>
        <RadialBarChart innerRadius="24%" outerRadius="92%" data={data} startAngle={180} endAngle={-180}>
          <RadialBar dataKey="value" background />
          <Tooltip />
          <Legend />
        </RadialBarChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'histogram' && spec.y) {
    const data = getHistogram(analysis.rows, spec.y)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill={palette[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'numericBar' && spec.x && spec.y) {
    const data = getGroupedNumeric(analysis.rows, spec.x, spec.y)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="average" fill={palette[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'lineTrend' && spec.x && spec.y) {
    const data = getDateSeries(analysis.rows, spec.x, spec.y)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="average" stroke={palette[0]} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'areaTrend' && spec.x && spec.y) {
    const data = getDateSeries(analysis.rows, spec.x, spec.y)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="average" stroke={palette[3]} fill={palette[3]} fillOpacity={0.18} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'composedTrend' && spec.x && spec.y) {
    const data = getDateSeries(analysis.rows, spec.x, spec.y)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill={palette[4]} opacity={0.35} />
          <Line type="monotone" dataKey="average" stroke={palette[0]} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'dateVolume' && spec.x) {
    const data = getDateSeries(analysis.rows, spec.x)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="count" stroke={palette[4]} fill={palette[4]} fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'scatter' && spec.x && spec.y) {
    const data = analysis.rows
      .map((row) => ({ x: parseNumber(row[spec.x!]), y: parseNumber(row[spec.y!]) }))
      .filter((row) => isFiniteNumber(row.x) && isFiniteNumber(row.y))
      .slice(0, 500)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" name={spec.x} type="number" />
          <YAxis dataKey="y" name={spec.y} type="number" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill={palette[5]} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (spec.kind === 'boxPlot' && spec.y) {
    const stats = analysis.columns.find((column) => column.name === spec.y)?.numeric
    if (!stats) return null
    const spread = stats.max - stats.min || 1
    return (
      <div className="box-plot">
        <div className="box-track">
          <span className="whisker" style={{ left: `${position(stats.min, stats.min, spread)}%` }} />
          <span className="box" style={{ left: `${position(stats.q1, stats.min, spread)}%`, width: `${((stats.q3 - stats.q1) / spread) * 100}%` }} />
          <span className="median" style={{ left: `${position(stats.median, stats.min, spread)}%` }} />
        </div>
        <div className="box-values">
          <span>Min {formatNumber(stats.min)}</span>
          <span>Q1 {formatNumber(stats.q1)}</span>
          <span>Median {formatNumber(stats.median)}</span>
          <span>Q3 {formatNumber(stats.q3)}</span>
          <span>Max {formatNumber(stats.max)}</span>
        </div>
      </div>
    )
  }

  if (spec.kind === 'stackedBar' && spec.x && spec.series) {
    const { data, keys } = getStackedData(analysis.rows, spec.x, spec.series)
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          {keys.map((key, index) => (
            <Bar key={key} dataKey={key} stackId="a" fill={palette[index % palette.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return <div className="empty-chart">No chart available for this data shape.</div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function TypeGroup({ icon, label, columns }: { icon: React.ReactNode; label: string; columns: ColumnProfile[] }) {
  return (
    <div className="type-group">
      <div className="type-label">
        {icon}
        <span>{label}</span>
        <b>{columns.length}</b>
      </div>
      <div className="chip-list">
        {columns.length ? columns.map((column) => <span key={column.name}>{column.name}</span>) : <em>None detected</em>}
      </div>
    </div>
  )
}

function FilterPanel({
  baseAnalysis,
  filters,
  onChange,
  onReset,
}: {
  baseAnalysis: Analysis
  filters: FilterState
  onChange: (filters: FilterState) => void
  onReset: () => void
}) {
  const categoryColumns = baseAnalysis.columns.filter((column) => ['commonText', 'boolean'].includes(column.type)).slice(0, 5)
  const numberColumns = baseAnalysis.columns.filter((column) => column.type === 'number').slice(0, 4)
  const dateColumns = baseAnalysis.columns.filter((column) => column.type === 'date').slice(0, 3)

  function updateCategory(column: string, value: string) {
    onChange({ ...filters, categories: { ...filters.categories, [column]: value } })
  }

  function updateNumber(column: string, boundary: 'min' | 'max', value: string) {
    onChange({
      ...filters,
      numbers: {
        ...filters.numbers,
        [column]: { min: filters.numbers[column]?.min ?? '', max: filters.numbers[column]?.max ?? '', [boundary]: value },
      },
    })
  }

  function updateDate(column: string, boundary: 'from' | 'to', value: string) {
    onChange({
      ...filters,
      dates: {
        ...filters.dates,
        [column]: { from: filters.dates[column]?.from ?? '', to: filters.dates[column]?.to ?? '', [boundary]: value },
      },
    })
  }

  return (
    <div className="filter-panel">
      <div className="panel-title">
        <Filter size={18} />
        <span>Filters</span>
        <button className="text-button" onClick={onReset}>Reset</button>
      </div>
      <label className="filter-field">
        <span>Search all text</span>
        <input value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="Search rows" />
      </label>
      {categoryColumns.map((column) => (
        <label className="filter-field" key={column.name}>
          <span>{column.name}</span>
          <select value={filters.categories[column.name] ?? ''} onChange={(event) => updateCategory(column.name, event.target.value)}>
            <option value="">All values</option>
            {(column.topValues ?? []).map((item) => (
              <option value={item.name} key={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
      ))}
      {numberColumns.map((column) => (
        <div className="filter-field" key={column.name}>
          <span>{column.name} range</span>
          <div className="range-row">
            <input
              value={filters.numbers[column.name]?.min ?? ''}
              onChange={(event) => updateNumber(column.name, 'min', event.target.value)}
              placeholder={column.numeric ? formatNumber(column.numeric.min) : 'Min'}
              inputMode="decimal"
            />
            <input
              value={filters.numbers[column.name]?.max ?? ''}
              onChange={(event) => updateNumber(column.name, 'max', event.target.value)}
              placeholder={column.numeric ? formatNumber(column.numeric.max) : 'Max'}
              inputMode="decimal"
            />
          </div>
        </div>
      ))}
      {dateColumns.map((column) => (
        <div className="filter-field" key={column.name}>
          <span>{column.name} dates</span>
          <div className="range-row">
            <input type="date" value={filters.dates[column.name]?.from ?? ''} onChange={(event) => updateDate(column.name, 'from', event.target.value)} />
            <input type="date" value={filters.dates[column.name]?.to ?? ''} onChange={(event) => updateDate(column.name, 'to', event.target.value)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ColumnCard({ column, rows }: { column: ColumnProfile; rows: number }) {
  const formula = getFormulaText(column)
  return (
    <article className="column-card">
      <div className="column-top">
        <div>
          <h3>{column.name}</h3>
          <span>{column.type}</span>
        </div>
        <b>{Math.round(column.confidence * 100)}%</b>
      </div>
      <div className="column-stats">
        <span>Filled {column.filled}/{rows}</span>
        <span>Missing {column.missing}</span>
        <span>Unique {column.unique}</span>
      </div>
      {column.numeric && (
        <div className="mini-stats">
          <span>Mean {formatNumber(column.numeric.mean)}</span>
          <span>Std dev {formatNumber(column.numeric.stdDev)}</span>
          <span>Range {formatNumber(column.numeric.min)} to {formatNumber(column.numeric.max)}</span>
        </div>
      )}
      <p className="formula">{formula}</p>
      <p className="sample">Sample: {column.sample.join(', ') || 'empty'}</p>
    </article>
  )
}

function DataPreview({ rows, columns }: { rows: DataRow[]; columns: string[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{normalizeCell(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function getFormulaText(column: ColumnProfile) {
  if (column.type === 'number') {
    return 'Numeric formulas: mean = sum(x) / n; sample variance = sum((x - mean)^2) / (n - 1); standard deviation = sqrt(variance).'
  }
  if (column.type === 'date') {
    return 'Date formulas: parsed valid dates, then min(date), max(date), and grouped time buckets for trend charts.'
  }
  if (column.type === 'commonText') {
    return 'Category formula: frequency(value) = count(rows where column = value); share = frequency / filled rows.'
  }
  return 'Text formula: treated as descriptive text because cardinality is high or values are long/free-form.'
}

function normalizeCell(value: unknown) {
  return String(value ?? '').trim()
}

function parseNumber(value: unknown) {
  const cleaned = normalizeCell(value).replace(/[$,%\s]/g, '').replace(/,/g, '')
  if (!cleaned || /^[-+]?\.?$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}

function parseDate(value: unknown) {
  const raw = normalizeCell(value)
  if (!raw || /^\d+(\.\d+)?$/.test(raw)) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  return year >= 1900 && year <= 2200 ? date : null
}

function isFiniteNumber(value: number): value is number {
  return Number.isFinite(value)
}

function ratio(value: number, total: number) {
  return total ? value / total : 0
}

function getNumericStats(values: number[]): NumericStats {
  const count = values.length
  const sum = values.reduce((total, value) => total + value, 0)
  const mean = sum / count
  const variance = count > 1 ? values.reduce((total, value) => total + (value - mean) ** 2, 0) / (count - 1) : 0
  return {
    count,
    sum,
    min: values[0],
    max: values[count - 1],
    mean,
    median: quantile(values, 0.5),
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
    variance,
    stdDev: Math.sqrt(variance),
  }
}

function getDateStats(values: Date[]): DateStats {
  const sorted = [...values].sort((a, b) => a.getTime() - b.getTime())
  return { count: sorted.length, min: sorted[0], max: sorted[sorted.length - 1] }
}

function quantile(sortedValues: number[], q: number) {
  if (sortedValues.length === 1) return sortedValues[0]
  const positionValue = (sortedValues.length - 1) * q
  const base = Math.floor(positionValue)
  const rest = positionValue - base
  const next = sortedValues[base + 1]
  return next === undefined ? sortedValues[base] : sortedValues[base] + rest * (next - sortedValues[base])
}

function countValues(values: string[]) {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return Array.from(counts, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

function getCategoryCounts(rows: DataRow[], column: string, limit: number) {
  return countValues(rows.map((row) => normalizeCell(row[column]) || 'Missing')).slice(0, limit)
}

function getGroupedNumeric(rows: DataRow[], category: string, numeric: string) {
  const groups = new Map<string, { sum: number; count: number }>()
  rows.forEach((row) => {
    const key = normalizeCell(row[category]) || 'Missing'
    const value = parseNumber(row[numeric])
    if (!isFiniteNumber(value)) return
    const current = groups.get(key) ?? { sum: 0, count: 0 }
    groups.set(key, { sum: current.sum + value, count: current.count + 1 })
  })
  return Array.from(groups, ([name, item]) => ({ name, average: item.sum / item.count, count: item.count }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 12)
}

function getHistogram(rows: DataRow[], column: string) {
  const values = rows.map((row) => parseNumber(row[column])).filter(isFiniteNumber).sort((a, b) => a - b)
  if (!values.length) return []
  const min = values[0]
  const max = values[values.length - 1]
  const binCount = Math.min(14, Math.max(5, Math.ceil(Math.log2(values.length) + 1)))
  const width = (max - min || 1) / binCount
  const bins = Array.from({ length: binCount }, (_, index) => ({
    name: `${formatNumber(min + index * width)}-${formatNumber(min + (index + 1) * width)}`,
    value: 0,
  }))
  values.forEach((value) => {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width))
    bins[index].value += 1
  })
  return bins
}

function getDateSeries(rows: DataRow[], dateColumn: string, numericColumn?: string) {
  const groups = new Map<string, { sum: number; count: number }>()
  rows.forEach((row) => {
    const date = parseDate(row[dateColumn])
    if (!date) return
    const key = date.toISOString().slice(0, 7)
    const current = groups.get(key) ?? { sum: 0, count: 0 }
    const value = numericColumn ? parseNumber(row[numericColumn]) : 1
    groups.set(key, {
      sum: current.sum + (isFiniteNumber(value) ? value : 0),
      count: current.count + 1,
    })
  })
  return Array.from(groups, ([name, item]) => ({
    name,
    count: item.count,
    average: numericColumn ? item.sum / item.count : item.count,
  })).sort((a, b) => a.name.localeCompare(b.name))
}

function getStackedData(rows: DataRow[], xColumn: string, seriesColumn: string) {
  const xValues = getCategoryCounts(rows, xColumn, 8).map((item) => item.name)
  const seriesValues = getCategoryCounts(rows, seriesColumn, 5).map((item) => item.name)
  const data = xValues.map((xValue) => {
    const item: Record<string, string | number> = { name: xValue }
    seriesValues.forEach((seriesValue) => {
      item[seriesValue] = rows.filter(
        (row) => (normalizeCell(row[xColumn]) || 'Missing') === xValue && (normalizeCell(row[seriesColumn]) || 'Missing') === seriesValue,
      ).length
    })
    return item
  })
  return { data, keys: seriesValues }
}

function groupColumnsByType(columns: ColumnProfile[]) {
  return {
    number: columns.filter((column) => column.type === 'number'),
    date: columns.filter((column) => column.type === 'date'),
    commonText: columns.filter((column) => ['commonText', 'boolean'].includes(column.type)),
    text: columns.filter((column) => column.type === 'text'),
  }
}

function position(value: number, min: number, spread: number) {
  return ((value - min) / spread) * 100
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
}

function emptyFilters(): FilterState {
  return { search: '', categories: {}, numbers: {}, dates: {} }
}

function countActiveFilters(filters: FilterState) {
  const searchCount = filters.search.trim() ? 1 : 0
  const categoryCount = Object.values(filters.categories).filter(Boolean).length
  const numberCount = Object.values(filters.numbers).filter((range) => range.min || range.max).length
  const dateCount = Object.values(filters.dates).filter((range) => range.from || range.to).length
  return searchCount + categoryCount + numberCount + dateCount
}

function applyFilters(rows: DataRow[], columns: ColumnProfile[], filters: FilterState) {
  const searchableColumns = columns.filter((column) => column.type !== 'number' && column.type !== 'date').map((column) => column.name)
  const search = filters.search.trim().toLowerCase()

  return rows.filter((row) => {
    if (search && !searchableColumns.some((column) => normalizeCell(row[column]).toLowerCase().includes(search))) {
      return false
    }

    for (const [column, expected] of Object.entries(filters.categories)) {
      if (expected && normalizeCell(row[column]) !== expected) return false
    }

    for (const [column, range] of Object.entries(filters.numbers)) {
      const value = parseNumber(row[column])
      if (!isFiniteNumber(value)) return false
      const min = parseNumber(range.min)
      const max = parseNumber(range.max)
      if (range.min && isFiniteNumber(min) && value < min) return false
      if (range.max && isFiniteNumber(max) && value > max) return false
    }

    for (const [column, range] of Object.entries(filters.dates)) {
      const value = parseDate(row[column])
      if (!value) return false
      const from = range.from ? new Date(`${range.from}T00:00:00`) : null
      const to = range.to ? new Date(`${range.to}T23:59:59`) : null
      if (from && value < from) return false
      if (to && value > to) return false
    }

    return true
  })
}

function generateInsights(analysis: Analysis, sourceRowCount: number): Insight[] {
  if (!analysis.rows.length) {
    return [
      {
        title: 'No rows match the current filters',
        detail: 'Relax one or more filters to restore charts, profile statistics, and data preview rows.',
        tone: 'warn',
      },
    ]
  }

  const insights: Insight[] = []
  const numbers = analysis.columns.filter((column) => column.type === 'number' && column.numeric)
  const categories = analysis.columns.filter((column) => ['commonText', 'boolean'].includes(column.type))
  const dates = analysis.columns.filter((column) => column.type === 'date')

  if (analysis.metrics.totalRows < sourceRowCount) {
    insights.push({
      title: 'Filtered view is active',
      detail: `${analysis.metrics.totalRows.toLocaleString()} of ${sourceRowCount.toLocaleString()} source rows are currently included in the dashboard.`,
      tone: 'info',
    })
  }

  if (analysis.metrics.completeness < 90) {
    insights.push({
      title: 'Missing data needs attention',
      detail: `Overall completeness is ${analysis.metrics.completeness.toFixed(1)}%. Columns with missing values can distort averages and category shares.`,
      tone: 'warn',
    })
  } else {
    insights.push({
      title: 'Dataset is mostly complete',
      detail: `Completeness is ${analysis.metrics.completeness.toFixed(1)}%, so the current dashboard is using a strong base of filled cells.`,
      tone: 'good',
    })
  }

  const strongestCategory = categories
    .map((column) => ({ column, top: column.topValues?.[0] }))
    .filter((item): item is { column: ColumnProfile; top: { name: string; value: number } } => Boolean(item.top))
    .sort((a, b) => b.top.value / analysis.metrics.totalRows - a.top.value / analysis.metrics.totalRows)[0]

  if (strongestCategory) {
    const share = (strongestCategory.top.value / analysis.metrics.totalRows) * 100
    insights.push({
      title: `${strongestCategory.column.name} is concentrated`,
      detail: `${strongestCategory.top.name} represents ${share.toFixed(1)}% of visible rows, making it the leading value in that column.`,
      tone: share > 65 ? 'warn' : 'info',
    })
  }

  const groupInsight = findBestGroupedNumericInsight(analysis, numbers, categories)
  if (groupInsight) insights.push(groupInsight)

  const trendInsight = findTrendInsight(analysis, numbers, dates)
  if (trendInsight) insights.push(trendInsight)

  const outlierInsight = findOutlierInsight(numbers, analysis.rows)
  if (outlierInsight) insights.push(outlierInsight)

  const correlationInsight = findCorrelationInsight(analysis.rows, numbers)
  if (correlationInsight) insights.push(correlationInsight)

  return insights.slice(0, 6)
}

function findBestGroupedNumericInsight(analysis: Analysis, numbers: ColumnProfile[], categories: ColumnProfile[]): Insight | null {
  for (const number of numbers.slice(0, 4)) {
    for (const category of categories.slice(0, 4)) {
      const grouped = getGroupedNumeric(analysis.rows, category.name, number.name)
      if (grouped.length >= 2) {
        const leader = grouped[0]
        const runnerUp = grouped[1]
        const lift = runnerUp.average ? ((leader.average - runnerUp.average) / Math.abs(runnerUp.average)) * 100 : 0
        return {
          title: `${leader.name} leads ${number.name}`,
          detail: `${category.name} = ${leader.name} has the highest average ${number.name} at ${formatNumber(leader.average)}${Number.isFinite(lift) ? `, ${Math.abs(lift).toFixed(1)}% above the next group` : ''}.`,
          tone: 'good',
        }
      }
    }
  }
  return null
}

function findTrendInsight(analysis: Analysis, numbers: ColumnProfile[], dates: ColumnProfile[]): Insight | null {
  const date = dates[0]
  const number = numbers[0]
  if (!date || !number) return null
  const series = getDateSeries(analysis.rows, date.name, number.name)
  if (series.length < 2) return null
  const first = series[0]
  const last = series[series.length - 1]
  const delta = last.average - first.average
  const percent = first.average ? (delta / Math.abs(first.average)) * 100 : 0
  return {
    title: `${number.name} ${delta >= 0 ? 'increased' : 'decreased'} over time`,
    detail: `From ${first.name} to ${last.name}, average ${number.name} moved from ${formatNumber(first.average)} to ${formatNumber(last.average)} (${percent.toFixed(1)}%).`,
    tone: delta >= 0 ? 'good' : 'warn',
  }
}

function findOutlierInsight(numbers: ColumnProfile[], rows: DataRow[]): Insight | null {
  for (const column of numbers) {
    if (!column.numeric) continue
    const iqr = column.numeric.q3 - column.numeric.q1
    if (!iqr) continue
    const lower = column.numeric.q1 - 1.5 * iqr
    const upper = column.numeric.q3 + 1.5 * iqr
    const outliers = rows.filter((row) => {
      const value = parseNumber(row[column.name])
      return isFiniteNumber(value) && (value < lower || value > upper)
    }).length
    if (outliers) {
      return {
        title: `${column.name} has possible outliers`,
        detail: `${outliers.toLocaleString()} row${outliers === 1 ? '' : 's'} fall outside the IQR bounds [${formatNumber(lower)}, ${formatNumber(upper)}].`,
        tone: 'warn',
      }
    }
  }
  return null
}

function findCorrelationInsight(rows: DataRow[], numbers: ColumnProfile[]): Insight | null {
  let best: { a: string; b: string; r: number } | null = null
  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      const pairs = rows
        .map((row) => [parseNumber(row[numbers[i].name]), parseNumber(row[numbers[j].name])] as const)
        .filter(([a, b]) => isFiniteNumber(a) && isFiniteNumber(b))
      if (pairs.length < 3) continue
      const r = pearsonCorrelation(pairs)
      if (!best || Math.abs(r) > Math.abs(best.r)) {
        best = { a: numbers[i].name, b: numbers[j].name, r }
      }
    }
  }
  if (!best || Math.abs(best.r) < 0.45) return null
  return {
    title: `${best.a} and ${best.b} move ${best.r >= 0 ? 'together' : 'oppositely'}`,
    detail: `Pearson correlation is ${best.r.toFixed(2)}, which indicates a ${Math.abs(best.r) >= 0.7 ? 'strong' : 'moderate'} relationship in the visible rows.`,
    tone: 'info',
  }
}

function pearsonCorrelation(pairs: readonly (readonly [number, number])[]) {
  const n = pairs.length
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / n
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / n
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0)
  const xDenominator = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0))
  const yDenominator = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0))
  return xDenominator && yDenominator ? numerator / (xDenominator * yDenominator) : 0
}

const sampleRows: DataRow[] = [
  { order_date: '2025-01-04', city: 'Mumbai', category: 'Electronics', revenue: '21500', quantity: '3', rating: '4.6', status: 'Delivered' },
  { order_date: '2025-01-18', city: 'Delhi', category: 'Fashion', revenue: '8400', quantity: '2', rating: '4.1', status: 'Delivered' },
  { order_date: '2025-02-02', city: 'Pune', category: 'Home', revenue: '12300', quantity: '5', rating: '4.3', status: 'Returned' },
  { order_date: '2025-02-16', city: 'Mumbai', category: 'Fashion', revenue: '15600', quantity: '4', rating: '4.7', status: 'Delivered' },
  { order_date: '2025-03-08', city: 'Bengaluru', category: 'Electronics', revenue: '28900', quantity: '2', rating: '4.8', status: 'Delivered' },
  { order_date: '2025-03-22', city: 'Delhi', category: 'Grocery', revenue: '5200', quantity: '8', rating: '3.9', status: 'Pending' },
  { order_date: '2025-04-06', city: 'Pune', category: 'Electronics', revenue: '19600', quantity: '1', rating: '4.5', status: 'Delivered' },
  { order_date: '2025-04-25', city: 'Bengaluru', category: 'Home', revenue: '14200', quantity: '3', rating: '4.2', status: 'Returned' },
  { order_date: '2025-05-10', city: 'Mumbai', category: 'Grocery', revenue: '6900', quantity: '9', rating: '4.0', status: 'Delivered' },
  { order_date: '2025-05-29', city: 'Delhi', category: 'Electronics', revenue: '31200', quantity: '2', rating: '4.9', status: 'Delivered' },
]

export default App
