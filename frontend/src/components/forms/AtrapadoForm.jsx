import { useState } from 'react'
import { Formik, Form } from 'formik'
import * as Yup from 'yup'
import { TextInput, NumberInput, TextArea, SubmitButton, FormStatus } from './FormControls'
import LocationPicker from './LocationPicker'
import PhotoUpload from './PhotoUpload'
import { createAtrapado, resolveFotoUrl } from './formApi'

const schema = Yup.object({
  cantidad_personas: Yup.number()
    .typeError('Indica cuántas personas')
    .integer('Número entero')
    .min(1, 'Debe ser al menos 1')
    .max(999)
    .required('La cantidad de personas es obligatoria'),
  edificio: Yup.string().trim().max(120),
  piso: Yup.string().trim().max(40),
  descripcion: Yup.string().trim().max(600, 'Máximo 600 caracteres'),
  contacto: Yup.string().trim().max(120),
})

export default function AtrapadoForm({ onSuccess }) {
  const [coords, setCoords] = useState(null)
  const [foto, setFoto] = useState(null)
  const [coordError, setCoordError] = useState(false)

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4 rounded-lg border-l-4 border-red-600 bg-red-50 p-3">
        <h2 className="text-xl font-bold text-red-700">🚨 Reportar personas ATRAPADAS</h2>
        <p className="text-sm text-red-600">
          Rescate urgente. Estamos tomando tu ubicación automáticamente. Da la mayor cantidad de
          datos posible para que los rescatistas lleguen rápido.
        </p>
      </div>

      <Formik
        initialValues={{ cantidad_personas: '', edificio: '', piso: '', descripcion: '', contacto: '' }}
        validationSchema={schema}
        onSubmit={async (values, { setStatus, resetForm }) => {
          setStatus(null)
          if (!coords) {
            setCoordError(true)
            return
          }
          try {
            const foto_url = await resolveFotoUrl(foto)
            const data = await createAtrapado({
              cantidad_personas: Number(values.cantidad_personas),
              edificio: values.edificio.trim() || null,
              piso: values.piso.trim() || null,
              descripcion: values.descripcion.trim() || null,
              contacto: values.contacto.trim() || null,
              estado: 'atrapado',
              lat: coords.lat,
              lng: coords.lng,
              foto_url,
            })
            setStatus({ type: 'ok', message: '🚨 Reporte de rescate enviado. Ayuda en camino.' })
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
            <NumberInput
              name="cantidad_personas"
              label="¿Cuántas personas están atrapadas?"
              required
              min="1"
              max="999"
              placeholder="Número de personas"
            />

            <LocationPicker
              label="Ubicación del rescate"
              required
              autoLocate
              value={coords}
              onChange={(c) => {
                setCoords(c)
                setCoordError(false)
              }}
            />
            {coordError && (
              <span className="-mt-2 text-xs font-medium text-red-600">
                Marca la ubicación en el mapa o permite la geolocalización.
              </span>
            )}

            <div className="grid grid-cols-2 gap-3">
              <TextInput name="edificio" label="Edificio" placeholder="Nombre o referencia" />
              <TextInput name="piso" label="Piso / nivel" placeholder="Ej: 3, sótano" />
            </div>

            <TextArea
              name="descripcion"
              label="Detalles para el rescate"
              placeholder="Estado de las personas, accesos bloqueados, riesgos (gas, fuego, derrumbe)..."
            />

            <PhotoUpload value={foto} onChange={setFoto} label="Foto del lugar (opcional)" />

            <TextInput name="contacto" label="Contacto (nombre y/o teléfono)" placeholder="Opcional" />

            <FormStatus status={status} />
            <SubmitButton isSubmitting={isSubmitting} variant="danger">
              🚨 Enviar alerta de rescate
            </SubmitButton>
          </Form>
        )}
      </Formik>
    </div>
  )
}
