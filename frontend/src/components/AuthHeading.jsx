function AuthHeading({ eyebrow, title, subtitle, centered = false }) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-primary-dark sm:text-5xl">
        {title}
      </h1>
      {subtitle && <p className="mt-4 text-lg text-slate-500">{subtitle}</p>}
    </div>
  )
}

export default AuthHeading
