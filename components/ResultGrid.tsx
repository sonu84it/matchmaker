import { ImageCard } from "@/components/ImageCard";
import type { MatchCard } from "@/lib/types";

type ResultGridProps = {
  matches: MatchCard[];
  onCreateCouple: (match: MatchCard) => void;
  busy?: boolean;
};

export function ResultGrid({
  matches,
  onCreateCouple,
  busy,
}: ResultGridProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {matches.map((match) => (
        <ImageCard
          key={match.id}
          match={match}
          onCreateCouple={onCreateCouple}
          busy={busy}
        />
      ))}
    </div>
  );
}
