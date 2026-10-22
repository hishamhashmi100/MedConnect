function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary-dark sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-3 max-w-2xl text-lg text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export default PageHeading
