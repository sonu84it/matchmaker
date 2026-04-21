import type { CoupleScene } from "@/lib/types";

const scenes: CoupleScene[] = [
  "Cafe Date",
  "Travel",
  "Studio Portrait",
  "Festive",
  "Sunset Walk",
  "Weekend Brunch",
];

type SceneSelectorProps = {
  selected?: CoupleScene;
  onSelect: (scene: CoupleScene) => void;
};

export function SceneSelector({ selected, onSelect }: SceneSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {scenes.map((scene) => {
        const active = selected === scene;
        return (
          <button
            key={scene}
            type="button"
            onClick={() => onSelect(scene)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              active
                ? "bg-ink text-background"
                : "border border-white/10 bg-white/5 text-ink hover:bg-white/10"
            }`}
          >
            {scene}
          </button>
        );
      })}
    </div>
  );
}
