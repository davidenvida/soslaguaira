import { useState } from 'react'
import { Formik, Form } from 'formik'
import * as Yup from 'yup'
import { TextInput, NumberInput, TextArea, SelectInput, SubmitButton, FormStatus } from './FormControls'
import LocationPicker from './LocationPicker'
import PhotoUpload from './PhotoUpload'
import { createPersona, resolveFotoUrl } from './formApi'

const ESTADOS = [
  { value: 'desaparecido', label: 'Desaparecido' },
  { value: 'visto_con_vida', label: 'Visto con vida' },
  { value: 'herido', label: 'Herido' },
  { value: 'desconocido', label: 'No sé / desconocido' },
]

const schema = Yup.object({
  nombre: Yup.string().trim().required('El nombre es obligatorio'),
  edad: Yup.number().typeError('Edad inválida').integer().min(0).max(120).nullable(),
  estado: Yup.string().required(),
  descripcion: Yup.string().trim().max(600, 'Máximo 600 caracteres'),
  direccion: Yup.string().trim().max(200),
  edificio: Yup.string().trim().max(120),
  piso: Yup.string().trim().max(40),
  contacto_nombre: Yup.string().trim().max(120),
  contacto_telefono: Yup.string()
    .trim()
    .matches(/^[\d+\s()-]{7,20}$/, 'Teléfono inválido')
    .required('Un teléfono de contacto es obligatorio'),
})

export default function BuscoForm({ onSuccess }) {
  const [coords, setCoords] = useState(null)
  const [foto, setFoto] = useState(null)
  const [coordError, setCoordError] = useState(false)

  return (
    <div className="mx-auto w-full max-w-md">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">🔍 Busco a alguien</h2>
        <p className="text-sm text-gray-500">
          Reporta a una persona desaparecida. El sistema intentará hacer coincidir tu reporte con
          personas marcadas como a salvo.
        </p>
      </header>

      <Formik
        initialValues={{
          nombre: '',
          edad: '',
          estado: 'desaparecido',
          descripcion: '',
          direccion: '',
          edificio: '',
          piso: '',
          contacto_nombre: '',
          contacto_telefono: '',
        }}
        validationSchema={schema}
        onSubmit={async (values, { setStatus, resetForm }) => {
          setStatus(null)
          if (!coords) {
            setCoordError(true)
            return
          }
          try {
            const foto_url = await resolveFotoUrl(foto)
            const data = await createPersona({
              tipo: 'busco',
              nombre: values.nombre.trim(),
              edad: values.edad === '' ? null : Number(values.edad),
              estado: values.estado,
              descripcion: values.descripcion.trim() || null,
              direccion: values.direccion.trim() || null,
              edificio: values.edificio.trim() || null,
              piso: values.piso.trim() || null,
              contacto_nombre: values.contacto_nombre.trim() || null,
              contacto_telefono: values.contacto_telefono.trim(),
              lat: coords.lat,
              lng: coords.lng,
              foto_url,
            })
            setStatus({ type: 'ok', message: 'Reporte enviado. Buscando coincidencias...' })
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
            <TextInput name="nombre" label="Nombre de la persona" required placeholder="Nombre y apellido" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput name="edad" label="Edad" placeholder="Años" min="0" max="120" />
              <SelectInput name="estado" label="Estado conocido" options={ESTADOS} />
            </div>
            <TextArea
              name="descripcion"
              label="Descripción"
              placeholder="Ropa, señas particulares, dónde se le vio por última vez..."
            />

            <LocationPicker
              label="Última ubicación conocida"
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

            <div className="grid grid-cols-2 gap-3">
              <TextInput name="edificio" label="Edificio / zona" placeholder="Opcional" />
              <TextInput name="piso" label="Piso" placeholder="Opcional" />
            </div>
            <TextInput name="direccion" label="Dirección / referencia" placeholder="Opcional" />

            <PhotoUpload value={foto} onChange={setFoto} label="Foto de la persona (opcional)" />

            <div className="grid grid-cols-2 gap-3">
              <TextInput name="contacto_nombre" label="Tu nombre" placeholder="Quién reporta" />
              <TextInput name="contacto_telefono" label="Tu teléfono" required placeholder="04xx-xxxxxxx" />
            </div>

            <FormStatus status={status} />
            <SubmitButton isSubmitting={isSubmitting}>Enviar reporte</SubmitButton>
          </Form>
        )}
      </Formik>
    </div>
  )
}
