import type { MatchCard } from "@/lib/types";

type ImageCardProps = {
  match: MatchCard;
  onCreateCouple: (match: MatchCard) => void;
  busy?: boolean;
};

export function ImageCard({ match, onCreateCouple, busy }: ImageCardProps) {
  return (
    <div className="glass rounded-[28px] p-4 shadow-glow">
      <img
        src={match.imageUrl}
        alt={match.title}
        className="h-80 w-full rounded-[22px] object-cover"
      />
      <div className="space-y-3 px-1 pb-1 pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-mist/70">
            {match.title}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-ink">{match.tag}</h3>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onCreateCouple(match)}
            disabled={busy}
            className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-medium text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Couple Photo
          </button>
          <a
            href={match.imageUrl}
            download={`${match.kind}.png`}
            className="rounded-full border border-white/10 px-4 py-3 text-sm text-ink transition hover:bg-white/5"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
