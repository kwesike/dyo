export const ARCHDEACONRIES = [
  "Agodi",
  "Agbirigidi",
  "Agugu",
  "Akinyele",
  "Alakia/Egbeda",
  "Alegongo",
  "Cathedral",
  "Igbo Elerin",
  "Kutayi",
  "Olorunda",
  "Olorunsogo/Akanran",
  "Orogun",
  "Yemetu",
  "Non-Anglican",
] as const;

/** Merch collection points — cheaper than delivery and the usual choice. */
export const PICKUP_POINTS = [
  "Cathedral of St Peter's, Aremo",
  "St Stephen Anglican Church, Alegongo",
  "Collect at the programme venue",
] as const;

export const DELIVERY_FEE_NAIRA = {
  pickup: 0,
  residence_within_ibadan: 2000,
  outside_ibadan: 4500,
} as const;

export const SITE = {
  name: "Diocesan Youth Organization",
  shortName: "DYO",
  supportPhone: "",   // fill in
  supportEmail: "",   // fill in
};