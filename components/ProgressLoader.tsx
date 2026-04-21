const steps = [
  "Uploading image",
  "Reading your style",
  "Matching aesthetics",
  "Creating your AI partner",
];

type ProgressLoaderProps = {
  currentStep: number;
};

export function ProgressLoader({ currentStep }: ProgressLoaderProps) {
  return (
    <div className="glass rounded-[28px] p-6 shadow-glow">
      <div className="mb-6 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-accent to-mist transition-all duration-700"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="space-y-4">
        {steps.map((step, index) => {
          const active = index <= currentStep;
          return (
            <div
              key={step}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
            >
              <div
                className={`relative h-3 w-3 rounded-full ${
                  active ? "bg-accent" : "bg-white/10"
                }`}
              >
                {index === currentStep ? (
                  <span className="animate-ping absolute inset-0 rounded-full bg-accent/70" />
                ) : null}
              </div>
              <span className={active ? "text-ink" : "text-muted"}>{step}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted">
        This is an AI-generated fictional match.
      </p>
    </div>
  );
}
