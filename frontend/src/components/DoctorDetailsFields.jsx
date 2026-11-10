import Field from './Field'
import SelectField from './SelectField'

// The professional details a doctor gives on sign up and can edit later on the profile page.
// show(field) gives the error to display and touch(field) marks a field as visited.
function DoctorDetailsFields({ form, update, show, touch, specialties }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Specialty"
        value={form.specialty}
        onChange={(event) => {
          update('specialty', event.target.value)
          touch('specialty')
        }}
        onBlur={() => touch('specialty')}
        error={show('specialty')}
      >
        <option value="" disabled>
          Choose your specialty
        </option>
        {specialties.map((specialty) => (
          <option key={specialty}>{specialty}</option>
        ))}
      </SelectField>
      <Field
        label="PMDC registration number"
        placeholder="12345-P"
        value={form.pmdc_number}
        onChange={(event) => update('pmdc_number', event.target.value)}
        onBlur={() => touch('pmdc_number')}
        error={show('pmdc_number')}
        hint="As printed on your PMDC certificate. The admin team checks it."
        maxLength={20}
      />
      <Field
        label="Years of experience"
        type="number"
        inputMode="numeric"
        min="0"
        max="60"
        value={form.experience_years}
        onChange={(event) => update('experience_years', event.target.value)}
        onBlur={() => touch('experience_years')}
        error={show('experience_years')}
      />
    </div>
  )
}

export default DoctorDetailsFields
