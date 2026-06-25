import { useField } from 'formik'

const baseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 ' +
  'placeholder-gray-400 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-100'

function Wrapper({ label, name, required, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}
      {children}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </div>
  )
}

function ErrorMsg({ meta }) {
  if (!meta.touched || !meta.error) return null
  return <span className="text-xs font-medium text-red-600">{meta.error}</span>
}

export function TextInput({ label, required, hint, ...props }) {
  const [field, meta] = useField(props)
  return (
    <Wrapper label={label} name={props.name} required={required} hint={hint}>
      <input id={props.name} className={baseInput} {...field} {...props} />
      <ErrorMsg meta={meta} />
    </Wrapper>
  )
}

export function NumberInput({ label, required, hint, ...props }) {
  const [field, meta] = useField(props)
  return (
    <Wrapper label={label} name={props.name} required={required} hint={hint}>
      <input id={props.name} type="number" className={baseInput} {...field} {...props} />
      <ErrorMsg meta={meta} />
    </Wrapper>
  )
}

export function TextArea({ label, required, hint, rows = 3, ...props }) {
  const [field, meta] = useField(props)
  return (
    <Wrapper label={label} name={props.name} required={required} hint={hint}>
      <textarea id={props.name} rows={rows} className={baseInput} {...field} {...props} />
      <ErrorMsg meta={meta} />
    </Wrapper>
  )
}

export function SelectInput({ label, required, hint, options, ...props }) {
  const [field, meta] = useField(props)
  return (
    <Wrapper label={label} name={props.name} required={required} hint={hint}>
      <select id={props.name} className={baseInput} {...field} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ErrorMsg meta={meta} />
    </Wrapper>
  )
}

export function SubmitButton({ isSubmitting, children, variant = 'primary', disabled }) {
  const styles = {
    primary: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
    danger: 'bg-red-700 hover:bg-red-800 focus:ring-red-400 text-lg uppercase tracking-wide',
    safe: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300',
  }
  return (
    <button
      type="submit"
      disabled={isSubmitting || disabled}
      className={
        'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white ' +
        'shadow-sm outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ' +
        styles[variant]
      }
    >
      {isSubmitting && (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {isSubmitting ? 'Enviando...' : children}
    </button>
  )
}

export function FormStatus({ status }) {
  if (!status) return null
  const isError = status.type === 'error'
  return (
    <div
      role="status"
      className={
        'rounded-lg px-3 py-2 text-sm font-medium ' +
        (isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')
      }
    >
      {status.message}
    </div>
  )
}
