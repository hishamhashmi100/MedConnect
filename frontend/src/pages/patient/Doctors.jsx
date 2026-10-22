import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import client, { getErrorMessage } from '../../api/client'
import Alert from '../../components/Alert'
import DoctorCard from '../../components/DoctorCard'
import SelectField from '../../components/SelectField'

const SORT_OPTIONS = [
  { value: 'earliest', label: 'Earliest available' },
  { value: 'fee_low', label: 'Fee: low to high' },
  { value: 'fee_high', label: 'Fee: high to low' },
  { value: 'experience', label: 'Most experienced' },
]

// The URL holds the applied filters, so a search can be shared or refreshed
function filtersFromUrl(searchParams) {
  return {
    specialty: searchParams.get('specialty') || '',
    symptom: searchParams.get('symptom') || '',
    consultation_type: searchParams.get('consultation_type') || '',
    city: searchParams.get('city') || 'Karachi',
  }
}

function withoutEmpty(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value))
}

function Doctors() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => filtersFromUrl(searchParams))
  const [lastUrl, setLastUrl] = useState(searchParams.toString())
  const [options, setOptions] = useState({ specialties: [], symptoms: [], cities: [] })
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const q = searchParams.get('q') || ''
  const sort = searchParams.get('sort') || 'earliest'
  const applied = filtersFromUrl(searchParams)

  // The top bar search can change the URL while this page is open, so reset the form to match
  if (searchParams.toString() !== lastUrl) {
    setLastUrl(searchParams.toString())
    setFilters(filtersFromUrl(searchParams))
  }

  useEffect(() => {
    Promise.all([
      client.get('/meta/specialties'),
      client.get('/meta/symptoms'),
      client.get('/meta/cities'),
    ])
      .then(([specialties, symptoms, cities]) =>
        setOptions({ specialties: specialties.data, symptoms: symptoms.data, cities: cities.data }),
      )
      .catch((err) => setError(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    let ignore = false
    client
      .get('/doctors', { params: withoutEmpty({ ...filtersFromUrl(searchParams), q, sort }) })
      .then((response) => {
        if (!ignore) setDoctors(response.data)
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    // A slower, older request must not overwrite newer results
    return () => {
      ignore = true
    }
  }, [searchParams, q, sort])

  function update(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function applySearch(event) {
    event.preventDefault()
    setError('')
    setSearchParams(withoutEmpty({ ...filters, q, sort }))
  }

  function changeSort(value) {
    setSearchParams(withoutEmpty({ ...applied, q, sort: value }))
  }

  function clearQuery() {
    setSearchParams(withoutEmpty({ ...applied, sort }))
  }

  const symptomMatch = options.symptoms.find((item) => item.symptom === applied.symptom)

  return (
    <div className="space-y-8">
      <form
        onSubmit={applySearch}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.8fr_auto]"
      >
        <SelectField
          label="Specialty"
          value={filters.specialty}
          onChange={(event) => update('specialty', event.target.value)}
        >
          <option value="">All specialties</option>
          {options.specialties.map((specialty) => (
            <option key={specialty}>{specialty}</option>
          ))}
        </SelectField>
        <SelectField
          label="Symptom"
          value={filters.symptom}
          onChange={(event) => update('symptom', event.target.value)}
        >
          <option value="">Select symptoms</option>
          {options.symptoms.map((item) => (
            <option key={item.symptom}>{item.symptom}</option>
          ))}
        </SelectField>
        <SelectField
          label="Consultation type"
          value={filters.consultation_type}
          onChange={(event) => update('consultation_type', event.target.value)}
        >
          <option value="">Any type</option>
          <option value="clinic">In-clinic visit</option>
          <option value="home">Home visit</option>
        </SelectField>
        <SelectField
          label="City"
          value={filters.city}
          onChange={(event) => update('city', event.target.value)}
        >
          {options.cities.map((city) => (
            <option key={city}>{city}</option>
          ))}
        </SelectField>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark"
        >
          <Search size={22} /> Search
        </button>
      </form>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
            Approved directory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary-dark sm:text-4xl">
            Find the right doctor
          </h1>
          {!loading && (
            <p className="mt-3 text-lg text-slate-500">
              {doctors.length} admin-approved {doctors.length === 1 ? 'doctor' : 'doctors'}{' '}
              available in {applied.city}
            </p>
          )}
        </div>
        <div className="w-full sm:w-64">
          <SelectField
            label="Sort by"
            value={sort}
            onChange={(event) => changeSort(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {(q || symptomMatch) && (
        <div className="flex flex-wrap gap-3">
          {q && (
            <span className="flex items-center gap-2 rounded-full bg-mint px-4 py-2 font-medium text-primary-dark">
              Results for &ldquo;{q}&rdquo;
              <button type="button" onClick={clearQuery} aria-label="Clear search">
                <X size={16} />
              </button>
            </span>
          )}
          {symptomMatch && (
            <span className="rounded-full bg-mint px-4 py-2 font-medium text-primary-dark">
              {symptomMatch.symptom} is usually seen by a {symptomMatch.specialty}
            </span>
          )}
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <p className="text-slate-500">Loading doctors...</p>
      ) : (
        <div className="space-y-5">
          {doctors.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No doctors match these filters. Try a different specialty, symptom or city.
            </div>
          )}
          {doctors.map((doctor) => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              action={
                <Link
                  to={`/doctors/${doctor.id}/book`}
                  className="inline-block rounded-2xl bg-primary px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark"
                >
                  Book Appointment
                </Link>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Doctors
