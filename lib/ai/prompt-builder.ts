import type { CoupleScene, StyleProfile } from "@/lib/types";

const renderPalette = (colors: string[]) => colors.join(", ");

export function buildSimilarPrompt(profile: StyleProfile) {
  return [
    "Create a photorealistic adult partner portrait for a dating-style prototype.",
    "Make the person feel aesthetically compatible with the uploaded user without copying the user's identity or face.",
    `Keep age band aligned with ${profile.age_range}.`,
    `Presentation should feel ${profile.presentation}.`,
    `Style direction: ${profile.style}.`,
    `Clothing: ${profile.clothing_type}.`,
    `Color palette: ${renderPalette(profile.color_palette)}.`,
    `Mood: ${profile.mood}.`,
    `Lighting: ${profile.lighting}.`,
    `Scene: ${profile.scene_type}.`,
    "Natural expression, premium editorial look, realistic skin texture, clean anatomy, no text, no watermark, adult only.",
  ].join(" ");
}

export function buildComplementaryPrompt(profile: StyleProfile) {
  return [
    "Create a photorealistic adult partner portrait for a dating-style prototype.",
    "Make the person complementary rather than similar, while still visually believable as a match.",
    `Keep age band aligned with ${profile.age_range}.`,
    `Use a contrasting but compatible presentation to ${profile.presentation}.`,
    `Fashion should feel one step more dynamic than ${profile.style}.`,
    `Clothing should complement ${profile.clothing_type}.`,
    `Use accents that work with ${renderPalette(profile.color_palette)}.`,
    `Preserve overall mood compatibility with ${profile.mood}.`,
    `Keep lighting grounded in ${profile.lighting}.`,
    "Photorealistic, attractive, adult, warm approachable expression, refined styling, no copied face, no text, no watermark.",
  ].join(" ");
}

export function buildDreamPrompt(profile: StyleProfile) {
  return [
    "Create a photorealistic adult dream partner portrait for a dating-style prototype.",
    "The partner should feel aspirational, cinematic, and highly compatible without resembling the uploaded user.",
    `Keep age band aligned with ${profile.age_range}.`,
    `Elevate style from ${profile.style} into a premium editorial version.`,
    `Wardrobe inspiration should still coordinate with ${profile.clothing_type}.`,
    `Use a polished palette influenced by ${renderPalette(profile.color_palette)}.`,
    `Preserve emotional tone from ${profile.mood}.`,
    `Use flattering lighting inspired by ${profile.lighting}.`,
    "Natural smile or confident relaxed expression, realistic face, realistic hands if visible, ultra clean anatomy, no explicit content, adult only.",
  ].join(" ");
}

export function buildCouplePrompt(params: {
  profile: StyleProfile;
  partnerTag: string;
  scene: CoupleScene;
}) {
  return [
    "Create a photorealistic couple portrait for a fictional matchmaking prototype.",
    "Show one adult inspired by the uploaded user's fashion profile and one adult partner matching the selected result.",
    `Selected partner vibe: ${params.partnerTag}.`,
    `User profile style: ${params.profile.style}.`,
    `User clothing reference: ${params.profile.clothing_type}.`,
    `Shared palette: ${renderPalette(params.profile.color_palette)}.`,
    `Mood: ${params.profile.mood}.`,
    `Lighting inspiration: ${params.profile.lighting}.`,
    `Scene: ${params.scene}.`,
    "Both people should look adult, natural, affectionate but not sexual, coordinated outfits, premium lifestyle photography, clean anatomy, no text, no watermark.",
  ].join(" ");
}
