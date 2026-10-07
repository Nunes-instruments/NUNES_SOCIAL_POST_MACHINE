export const ENABLED_SOCIAL_PROVIDERS = [
  "linkedin",
  "facebook",
  "instagram",
  "youtube",
  "whatsapp"
];

export const STANDARD_PUBLISH_PROVIDERS = [
  "LinkedIn",
  "Facebook",
  "Instagram",
  "YouTube"
];

export const SOCIAL_PROVIDER_META = {
  linkedin: { label:"LinkedIn", icon:"in", purpose:"B2B authority, industry expertise and lead generation." },
  facebook: { label:"Facebook", icon:"f", purpose:"Page content, company updates and customer engagement." },
  instagram: { label:"Instagram", icon:"◎", purpose:"Visual product discovery, reels and brand awareness." },
  youtube: { label:"YouTube", icon:"▶", purpose:"Product demos, tutorials and searchable technical education." },
  whatsapp: { label:"WhatsApp", icon:"WA", purpose:"Business messaging and multi-number account management." }
};

export function isEnabledProvider(idOrLabel){
  const id=String(idOrLabel||"").trim().toLowerCase();
  return ENABLED_SOCIAL_PROVIDERS.includes(id);
}
