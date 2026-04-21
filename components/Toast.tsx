type ToastProps = {
  message?: string | null;
};

export function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full border border-white/10 bg-black/80 px-5 py-3 text-sm text-ink shadow-2xl backdrop-blur-xl">
      {message}
    </div>
  );
}
