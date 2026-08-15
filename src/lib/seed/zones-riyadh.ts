import type { Geometry } from "@/lib/geo";

/**
 * Riyadh airspace — **authored for this proposal, not official GACA airspace.**
 *
 * The geographic anchors are public fact: the airport is where the airport is,
 * Diriyah is where Diriyah is, the city extends about as far as this ring says.
 * The **permissions** attached to them — ceilings, hours, capacities, which
 * build types are welcome — are the proposal itself, and are not adopted by
 * anyone. A disclaimer appears on every surface that renders these zones.
 *
 * The model is **default-deny**: `RUH-R-CITY` covers greater Riyadh and refuses
 * everything, permitted zones carve out the places you may actually fly, and
 * no-fly overlays beat both.
 *
 * Permitted zones are **separate rows, not holes** punched in the restricted
 * polygon. Precedence in F12 resolves the carve-out; interior rings stay
 * reserved for genuinely annular geometry — of which `RUH-NF-KKIA` is the one
 * real case.
 *
 * Every coordinate below is a frozen literal in `[lng, lat]` order. No
 * `Math.random()`, no `Date.now()` — re-seeding produces an identical airspace.
 */

export type SeedZone = {
  code: string;
  kind: "permitted" | "restricted" | "no_fly";
  nameAr: string;
  nameEn: string;
  districtAr: string;
  districtEn: string;
  notesAr: string;
  notesEn: string;
  geometry: Geometry;
  ceilingAglM: number | null;
  floorAglM?: number;
  capacity?: number;
  slotDurationMinutes?: number;
  minLeadMinutes?: number;
  maxAdvanceDays?: number;
  maxSlotsPerPilotPerDay?: number;
  autoApprove?: boolean;
  nightAllowed?: boolean;
  maxWeightClass?: "micro" | "light" | "medium" | "heavy";
  permittedBuildTypes?: ("commercial" | "self_built" | "fpv")[];
  requiresBroadcastRid?: boolean;
  authorityRef: string;
};

export const RIYADH_ZONES: SeedZone[] = [
  // --- The default-deny base ---------------------------------------------
  {
    code: "RUH-R-CITY",
    kind: "restricted",
    nameAr: "منطقة الرياض الكبرى",
    nameEn: "Greater Riyadh Area",
    districtAr: "منطقة الرياض",
    districtEn: "Riyadh Region",
    notesAr:
      "الأصل هو المنع. الطيران غير مسموح داخل هذه المنطقة إلا ضمن منطقة مسموحة معلنة.",
    notesEn:
      "Default-deny. Flight is not permitted inside this area except within a published permitted zone.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.15, 24.3],
          [47.15, 24.3],
          [47.15, 24.82],
          [46.98, 25.25],
          [46.42, 25.25],
          [46.15, 24.86],
          [46.15, 24.3],
        ],
      ],
    },
    // Nothing is permitted here, so a ceiling would be meaningless.
    ceilingAglM: null,
    authorityRef: "AJNIHA-PROPOSAL/RUH-BASE",
  },

  // --- Permitted carve-outs ----------------------------------------------
  {
    code: "RUH-P-01",
    kind: "permitted",
    nameAr: "الثمامة",
    nameEn: "Thumamah",
    districtAr: "شمال شرق الرياض",
    districtEn: "North-east Riyadh",
    notesAr:
      "صحراء مفتوحة بعيدة عن العمران. الأنسب لطائرات الـ FPV والمصنّعة ذاتياً. الحد الشمالي الغربي يلامس نطاق مطار الملك خالد — الأولوية للمنطقة المحظورة.",
    notesEn:
      "Open desert away from built-up areas. The most suitable zone for FPV and self-built aircraft. Its south-western edge meets the King Khalid CTR — the no-fly zone takes precedence there.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.52, 24.98],
          [46.66, 24.98],
          [46.7, 25.06],
          [46.64, 25.14],
          [46.53, 25.12],
          [46.49, 25.04],
          [46.52, 24.98],
        ],
      ],
    },
    ceilingAglM: 120,
    capacity: 6,
    slotDurationMinutes: 120,
    minLeadMinutes: 60,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 2,
    autoApprove: true,
    nightAllowed: false,
    maxWeightClass: "medium",
    permittedBuildTypes: ["commercial", "self_built", "fpv"],
    authorityRef: "AJNIHA-PROPOSAL/RUH-P-01",
  },
  {
    code: "RUH-P-02",
    kind: "permitted",
    nameAr: "الدرعية ووادي حنيفة",
    nameEn: "Diriyah and Wadi Hanifah",
    districtAr: "الدرعية",
    districtEn: "Diriyah",
    notesAr:
      "منطقة تراثية. التصوير مسموح بارتفاع منخفض، ويلزم بث الهوية عن بُعد مباشرةً.",
    notesEn:
      "Heritage area. Low-altitude camera work is permitted, and Direct Remote ID broadcast is required.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.55, 24.72],
          [46.62, 24.72],
          [46.63, 24.77],
          [46.58, 24.79],
          [46.54, 24.76],
          [46.55, 24.72],
        ],
      ],
    },
    ceilingAglM: 60,
    capacity: 3,
    slotDurationMinutes: 60,
    minLeadMinutes: 180,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 1,
    autoApprove: false,
    nightAllowed: false,
    maxWeightClass: "light",
    permittedBuildTypes: ["commercial", "self_built"],
    requiresBroadcastRid: true,
    authorityRef: "AJNIHA-PROPOSAL/RUH-P-02",
  },
  {
    code: "RUH-P-03",
    kind: "permitted",
    nameAr: "وادي نمار",
    nameEn: "Wadi Namar",
    districtAr: "جنوب الرياض",
    districtEn: "South Riyadh",
    notesAr: "منطقة ترفيهية. الإقبال مرتفع في نهاية الأسبوع.",
    notesEn: "Recreational area. Demand is highest at the weekend.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.6, 24.53],
          [46.66, 24.53],
          [46.67, 24.58],
          [46.61, 24.59],
          [46.59, 24.56],
          [46.6, 24.53],
        ],
      ],
    },
    ceilingAglM: 80,
    capacity: 4,
    slotDurationMinutes: 60,
    minLeadMinutes: 120,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 2,
    autoApprove: true,
    nightAllowed: false,
    maxWeightClass: "light",
    permittedBuildTypes: ["commercial", "self_built", "fpv"],
    authorityRef: "AJNIHA-PROPOSAL/RUH-P-03",
  },
  {
    code: "RUH-P-04",
    kind: "permitted",
    nameAr: "حديقة الملك سلمان",
    nameEn: "King Salman Park",
    districtAr: "وسط الرياض",
    districtEn: "Central Riyadh",
    notesAr:
      "منطقة حضرية مزدحمة. سقف منخفض، والطائرات الخفيفة فقط، ولا يُسمح بالطيران فوق التجمعات.",
    notesEn:
      "Dense urban area. Low ceiling, light aircraft only, and no flight over gatherings.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.72, 24.7],
          [46.77, 24.7],
          [46.78, 24.74],
          [46.73, 24.75],
          [46.71, 24.73],
          [46.72, 24.7],
        ],
      ],
    },
    ceilingAglM: 60,
    capacity: 2,
    slotDurationMinutes: 60,
    minLeadMinutes: 240,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 1,
    autoApprove: false,
    nightAllowed: false,
    maxWeightClass: "micro",
    permittedBuildTypes: ["commercial"],
    requiresBroadcastRid: true,
    authorityRef: "AJNIHA-PROPOSAL/RUH-P-04",
  },
  {
    code: "RUH-P-05",
    kind: "permitted",
    nameAr: "الحاير",
    nameEn: "Al Hair",
    districtAr: "جنوب شرق الرياض",
    districtEn: "South-east Riyadh",
    notesAr: "مساحة واسعة مناسبة للتدريب والرحلات الطويلة.",
    notesEn: "A large area suited to training and longer sorties.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.7, 24.35],
          [46.82, 24.35],
          [46.84, 24.42],
          [46.76, 24.45],
          [46.69, 24.41],
          [46.7, 24.35],
        ],
      ],
    },
    ceilingAglM: 100,
    capacity: 5,
    slotDurationMinutes: 120,
    minLeadMinutes: 60,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 2,
    autoApprove: false,
    nightAllowed: false,
    maxWeightClass: "medium",
    permittedBuildTypes: ["commercial", "self_built", "fpv"],
    authorityRef: "AJNIHA-PROPOSAL/RUH-P-05",
  },
  {
    code: "RUH-P-06",
    kind: "permitted",
    nameAr: "العمارية",
    nameEn: "Ammariyah",
    districtAr: "غرب الرياض",
    districtEn: "West Riyadh",
    notesAr:
      "منطقة نائية قليلة السكان. الطيران الليلي مسموح مع إضاءة ملاحية مطابقة.",
    notesEn:
      "Remote and sparsely populated. Night flight is permitted with compliant navigation lighting.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.2, 24.8],
          [46.32, 24.8],
          [46.34, 24.87],
          [46.26, 24.9],
          [46.19, 24.86],
          [46.2, 24.8],
        ],
      ],
    },
    ceilingAglM: 120,
    capacity: 4,
    slotDurationMinutes: 120,
    minLeadMinutes: 120,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 2,
    autoApprove: false,
    nightAllowed: true,
    maxWeightClass: "medium",
    permittedBuildTypes: ["commercial", "self_built", "fpv"],
    authorityRef: "AJNIHA-PROPOSAL/RUH-P-06",
  },
  {
    code: "RUH-P-07",
    kind: "permitted",
    nameAr: "الجنادرية",
    nameEn: "Janadriyah",
    districtAr: "شمال شرق الرياض",
    districtEn: "North-east Riyadh",
    notesAr:
      "منطقة فعاليات. الإغلاقات المؤقتة متكررة هنا، فراجع حالة المنطقة قبل الحجز.",
    notesEn:
      "Events area. Temporary closures are frequent here — check the zone's status before booking.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.9, 24.88],
          [47.0, 24.88],
          [47.01, 24.93],
          [46.95, 24.96],
          [46.89, 24.92],
          [46.9, 24.88],
        ],
      ],
    },
    ceilingAglM: 90,
    capacity: 4,
    slotDurationMinutes: 60,
    minLeadMinutes: 120,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 2,
    autoApprove: false,
    nightAllowed: false,
    maxWeightClass: "light",
    permittedBuildTypes: ["commercial", "self_built", "fpv"],
    authorityRef: "AJNIHA-PROPOSAL/RUH-P-07",
  },

  // --- No-fly overlays ----------------------------------------------------
  {
    code: "RUH-NF-KKIA",
    kind: "no_fly",
    nameAr: "نطاق مطار الملك خالد الدولي",
    nameEn: "King Khalid International Airport CTR",
    districtAr: "شمال الرياض",
    districtEn: "North Riyadh",
    notesAr:
      "نطاق مراقبة المطار. القلب مستثنى لأنه ضمن سياج المطار وتحت إدارة المطار نفسه، وليس لأن الطيران مسموح فيه.",
    notesEn:
      "Airport control ring. The core is excluded because it sits inside the airfield perimeter and is managed by the airport itself — not because flight is allowed there.",
    /**
     * **The annulus.** The one genuinely annular shape in the seed, and the
     * reason the interior-ring code path in F12 is exercised rather than dead.
     * Outer ring ~8 km, counter-clockwise; interior ring ~2 km, clockwise, per
     * the GeoJSON right-hand rule.
     */
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.77807, 24.9576],
          [46.77203, 24.9851],
          [46.75485, 25.00842],
          [46.72913, 25.02399],
          [46.6988, 25.02946],
          [46.66847, 25.02399],
          [46.64275, 25.00842],
          [46.62557, 24.9851],
          [46.61953, 24.9576],
          [46.62557, 24.9301],
          [46.64275, 24.90678],
          [46.66847, 24.89121],
          [46.6988, 24.88574],
          [46.72913, 24.89121],
          [46.75485, 24.90678],
          [46.77203, 24.9301],
          [46.77807, 24.9576],
        ],
        [
          [46.71862, 24.9576],
          [46.71711, 24.95072],
          [46.71281, 24.9449],
          [46.70638, 24.941],
          [46.6988, 24.93963],
          [46.69122, 24.941],
          [46.68479, 24.9449],
          [46.68049, 24.95072],
          [46.67898, 24.9576],
          [46.68049, 24.96448],
          [46.68479, 24.9703],
          [46.69122, 24.9742],
          [46.6988, 24.97557],
          [46.70638, 24.9742],
          [46.71281, 24.9703],
          [46.71711, 24.96448],
          [46.71862, 24.9576],
        ],
      ],
    },
    ceilingAglM: 0,
    authorityRef: "AJNIHA-PROPOSAL/RUH-NF-KKIA",
  },
  {
    code: "RUH-NF-MOD",
    kind: "no_fly",
    nameAr: "منطقة وزارة الدفاع",
    nameEn: "Ministry of Defence Area",
    districtAr: "وسط الرياض",
    districtEn: "Central Riyadh",
    notesAr: "منشأة سيادية. لا يوجد استثناء.",
    notesEn: "Sovereign facility. No exception applies.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.69, 24.66],
          [46.73, 24.66],
          [46.73, 24.7],
          [46.69, 24.7],
          [46.69, 24.66],
        ],
      ],
    },
    ceilingAglM: 0,
    authorityRef: "AJNIHA-PROPOSAL/RUH-NF-MOD",
  },
  {
    code: "RUH-NF-DQ",
    kind: "no_fly",
    nameAr: "الحي الدبلوماسي",
    nameEn: "Diplomatic Quarter",
    districtAr: "غرب الرياض",
    districtEn: "West Riyadh",
    notesAr: "بعثات دبلوماسية. لا يوجد استثناء.",
    notesEn: "Diplomatic missions. No exception applies.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.6, 24.66],
          [46.65, 24.66],
          [46.65, 24.71],
          [46.6, 24.71],
          [46.6, 24.66],
        ],
      ],
    },
    ceilingAglM: 0,
    authorityRef: "AJNIHA-PROPOSAL/RUH-NF-DQ",
  },
  {
    code: "RUH-NF-ROYAL",
    kind: "no_fly",
    nameAr: "المقار الملكية",
    nameEn: "Royal Properties",
    districtAr: "وسط الرياض",
    districtEn: "Central Riyadh",
    notesAr: "مقار ملكية. لا يوجد استثناء.",
    notesEn: "Royal properties. No exception applies.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [46.69, 24.63],
          [46.73, 24.63],
          [46.73, 24.66],
          [46.69, 24.66],
          [46.69, 24.63],
        ],
      ],
    },
    ceilingAglM: 0,
    authorityRef: "AJNIHA-PROPOSAL/RUH-NF-ROYAL",
  },
];
