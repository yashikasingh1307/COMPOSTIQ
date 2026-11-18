import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)
export const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#233b2c', padding: 11, cornerRadius: 9 } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#92988a', maxTicksLimit: 6 } },
    y: { grid: { color: 'rgba(45,72,51,.08)' }, ticks: { color: '#92988a' }, border: { display: false } }
  },
  elements: { line: { tension: .36, borderWidth: 2.5 }, point: { radius: 0, hitRadius: 10, hoverRadius: 4 } }
}
