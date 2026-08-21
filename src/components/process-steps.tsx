export function ProcessSteps({
  steps,
}: {
  steps: { title: string; body: string }[];
}) {
  return (
    <ol className="relative border-l border-line pl-8 md:pl-10">
      {steps.map((step, index) => (
        <li key={step.title} className="relative pb-10 last:pb-0">
          <span className="absolute -left-[2.55rem] flex h-8 w-8 items-center justify-center rounded-full bg-gold font-serif text-sm text-white md:-left-[3.05rem]">
            {index + 1}
          </span>
          <h3 className="text-xl md:text-2xl">{step.title}</h3>
          <p className="mt-2 max-w-2xl text-[0.938rem] leading-relaxed text-ink-soft">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
