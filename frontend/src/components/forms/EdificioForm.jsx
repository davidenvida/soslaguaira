import { useState } from 'react'
import { Formik, Form } from 'formik'
import * as Yup from 'yup'
import { TextInput, NumberInput, TextArea, SelectInput, SubmitButton, FormStatus } from './FormControls'
import LocationPicker from './LocationPicker'
import PhotoUpload from './PhotoUpload'
import { createEdificio, resolveFotoUrl } from './formApi'

const ESTADOS = [
  { value: 'evacuado_ok', label: 'Evacuado / sin riesgo' },
  { value: 'dano_grave', label: 'Daño grave' },
  { value: 'atrapados', label: 'Hay personas atrapadas' },
  { value: 'en_rescate', label: 'En rescate' },
  { value: 'colapsado', label: 'Colapsado' },
]

const schema = Yup.object({
  nombre: Yup.string().trim().required('El nombre o referencia es obligatorio'),
  estado: Yup.string().required('Indica el estado del edificio'),
  atrapados_estimados: Yup.number()
    .typeError('Número inválido')
    .integer()
    .min(0)
    .max(9999)
    .nullable(),
  direccion: Yup.string().trim().max(200),
  descripcion: Yup.string().trim().max(600, 'Máximo 600 caracteres'),
})

export default function EdificioForm({ onSuccess }) {
  const [coords, setCoords] = useState(null)
  const [foto, setFoto] = useState(null)
  const [coordError, setCoordError] = useState(false)

  return (
    <div className="mx-auto w-full max-w-md">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">🏚️ Reportar estado de un edificio</h2>
        <p className="text-sm text-gray-500">
          Informa el estado de una estructura para orientar a los equipos de rescate y a la gente
          que busca refugio.
        </p>
      </header>

      <Formik
        initialValues={{ nombre: '', estado: 'dano_grave', atrapados_estimados: '', direccion: '', descripcion: '' }}
        validationSchema={schema}
        onSubmit={async (values, { setStatus, resetForm }) => {
          setStatus(null)
          if (!coords) {
            setCoordError(true)
            return
          }
          try {
            const foto_url = await resolveFotoUrl(foto)
            const data = await createEdificio({
              nombre: values.nombre.trim(),
              estado: values.estado,
              atrapados_estimados:
                values.atrapados_estimados === '' ? null : Number(values.atrapados_estimados),
              direccion: values.direccion.trim() || null,
              descripcion: values.descripcion.trim() || null,
              lat: coords.lat,
              lng: coords.lng,
              foto_url,
            })
            setStatus({ type: 'ok', message: 'Estado del edificio registrado. Gracias.' })
            resetForm()
            setCoords(null)
            setFoto(null)
            onSuccess?.(data)
          } catch (err) {
            setStatus({ type: 'error', message: err.message || 'No se pudo enviar el reporte.' })
          }
        }}
      >
        {({ isSubmitting, status }) => (
          <Form className="flex flex-col gap-4">
            <TextInput name="nombre" label="Nombre o referencia del edificio" required placeholder="Ej: Residencias El Faro" />

            <div className="grid grid-cols-2 gap-3">
              <SelectInput name="estado" label="Estado" required options={ESTADOS} />
              <NumberInput
                name="atrapados_estimados"
                label="Atrapados estimados"
                min="0"
                placeholder="Si aplica"
              />
            </div>

            <LocationPicker
              label="Ubicación del edificio"
              required
              value={coords}
              onChange={(c) => {
                setCoords(c)
                setCoordError(false)
              }}
            />
            {coordError && (
              <span className="-mt-2 text-xs font-medium text-red-600">
                Marca la ubicación en el mapa.
              </span>
            )}

            <TextInput name="direccion" label="Dirección / referencia" placeholder="Opcional" />
            <TextArea
              name="descripcion"
              label="Descripción del daño"
              placeholder="Tipo de daño, accesos, riesgos, número de pisos afectados..."
            />

            <PhotoUpload value={foto} onChange={setFoto} label="Foto del edificio (opcional)" />

            <FormStatus status={status} />
            <SubmitButton isSubmitting={isSubmitting}>Registrar estado</SubmitButton>
          </Form>
        )}
      </Formik>
    </div>
  )
}
