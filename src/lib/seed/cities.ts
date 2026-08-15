/**
 * Cities. Only Riyadh is modelled in this build — the others exist so an admin
 * can draw zones into them later without a migration, and so the city picker
 * isn't a list of one.
 *
 * Centroids are public geographic fact. Nothing here implies GACA has adopted,
 * reviewed, or endorsed anything.
 */
export const CITIES = [
  {
    code: "RUH",
    nameAr: "الرياض",
    nameEn: "Riyadh",
    centroidLat: 24.7136,
    centroidLng: 46.6753,
    isModelled: true,
  },
  {
    code: "JED",
    nameAr: "جدة",
    nameEn: "Jeddah",
    centroidLat: 21.4858,
    centroidLng: 39.1925,
    isModelled: false,
  },
  {
    code: "DMM",
    nameAr: "الدمام",
    nameEn: "Dammam",
    centroidLat: 26.4207,
    centroidLng: 50.0888,
    isModelled: false,
  },
  {
    code: "MAK",
    nameAr: "مكة المكرمة",
    nameEn: "Makkah",
    centroidLat: 21.3891,
    centroidLng: 39.8579,
    isModelled: false,
  },
  {
    code: "MED",
    nameAr: "المدينة المنورة",
    nameEn: "Madinah",
    centroidLat: 24.5247,
    centroidLng: 39.5692,
    isModelled: false,
  },
  {
    code: "ABT",
    nameAr: "أبها",
    nameEn: "Abha",
    centroidLat: 18.2164,
    centroidLng: 42.5053,
    isModelled: false,
  },
] as const;
