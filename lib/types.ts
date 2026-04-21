export type StyleProfile = {
  age_range: string;
  presentation: string;
  style: string;
  clothing_type: string;
  color_palette: string[];
  mood: string;
  lighting: string;
  scene_type: string;
  face_count?: number;
  safety?: {
    is_minor_suspected: boolean;
    is_explicit_suspected: boolean;
  };
};

export type MatchKind = "similar" | "complementary" | "dream";

export type MatchCard = {
  id: string;
  kind: MatchKind;
  title: string;
  tag: string;
  prompt: string;
  imageUrl: string;
  storagePath: string;
};

export type CoupleScene =
  | "Cafe Date"
  | "Travel"
  | "Studio Portrait"
  | "Festive"
  | "Sunset Walk"
  | "Weekend Brunch";

export type UploadRecord = {
  uploadId: string;
  sessionId: string;
  storagePath: string;
  mimeType: string;
  signedUrl?: string;
  createdAt: number;
};

export type GenerationRecord = {
  id: string;
  sessionId: string;
  uploadId: string;
  type: "partners" | "couple";
  imageUrl?: string;
  storagePath?: string;
  matches?: MatchCard[];
  profile?: StyleProfile;
  createdAt: number;
};
