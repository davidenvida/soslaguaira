import { useEffect, useRef, useState } from 'react'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB (contrato de datos)
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Componente controlado: el form guarda el File en value y lo sube al hacer submit.
export default function PhotoUpload({ value, onChange, label = 'Foto (opcional)' }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  function handleFile(file) {
    setError(null)
    if (!file) return
    if (!MIME_OK.includes(file.type)) {
      setError('Formato no permitido. Usa JPG, PNG, WEBP o GIF.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen supera el límite de 5 MB.')
      return
    }
    onChange(file)
  }

  function quitar() {
    onChange(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>

      {preview ? (
        <div className="relative w-fit">
          <img
            src={preview}
            alt="Vista previa"
            className="h-36 w-36 rounded-lg border border-gray-300 object-cover"
          />
          <button
            type="button"
            onClick={quitar}
            aria-label="Quitar foto"
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white shadow hover:bg-red-700"
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center transition hover:border-red-400 hover:bg-red-50"
        >
          <span className="text-2xl">📷</span>
          <span className="text-sm font-medium text-gray-600">Toca para tomar o subir una foto</span>
          <span className="text-xs text-gray-400">JPG, PNG, WEBP · máx 5 MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}

      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  )
}
