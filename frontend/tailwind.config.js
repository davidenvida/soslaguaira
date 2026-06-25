/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        urgente: '#dc2626',
        atrapado: '#ef4444',
        salvo: '#16a34a',
        desaparecido: '#f59e0b',
        edificio: '#7c3aed',
      },
    },
  },
  plugins: [],
}
