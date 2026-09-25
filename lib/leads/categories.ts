// Geoapify place categories, grouped for the Discover dropdown.
// Every category string here has been checked against the Places API.
export type BusinessType = { label: string; categories: string };
export const businessTypes: { group: string; types: Record<string, BusinessType> }[] = [
  {
    group: "Everything",
    types: {
      all: {
        label: "All local businesses",
        categories:
          "commercial,catering,service,office,healthcare,pet,accommodation,sport.fitness,childcare,education.driving_school,entertainment,production.brewery",
      },
    },
  },
  {
    group: "Food & drink",
    types: {
      food: { label: "All food & drink", categories: "catering,commercial.food_and_drink" },
      restaurants: { label: "Restaurants", categories: "catering.restaurant" },
      cafes: { label: "Cafés & ice cream", categories: "catering.cafe,catering.ice_cream" },
      takeaways: { label: "Takeaways", categories: "catering.fast_food" },
      pubs: { label: "Pubs & bars", categories: "catering.pub,catering.bar,catering.taproom" },
      foodShops: { label: "Bakeries, butchers & delis", categories: "commercial.food_and_drink" },
      breweries: { label: "Breweries & wineries", categories: "production.brewery,production.winery" },
    },
  },
  {
    group: "Shops",
    types: {
      shops: { label: "All shops", categories: "commercial" },
      clothing: {
        label: "Clothing & jewellery",
        categories: "commercial.clothing,commercial.jewelry,commercial.bag,commercial.watches",
      },
      gifts: {
        label: "Florists, gifts & antiques",
        categories:
          "commercial.florist,commercial.gift_and_souvenir,commercial.art,commercial.antiques,commercial.second_hand",
      },
      home: {
        label: "Home, garden & DIY",
        categories:
          "commercial.furniture_and_interior,commercial.garden,commercial.houseware_and_hardware",
      },
      hobbies: {
        label: "Books, toys & hobbies",
        categories:
          "commercial.hobby,commercial.books,commercial.toy_and_game,commercial.stationery,commercial.video_and_music",
      },
      electronics: { label: "Electronics & phones", categories: "commercial.elektronics" },
      carSales: { label: "Car & bike dealers", categories: "commercial.vehicle,commercial.outdoor_and_sport.bicycle" },
      sportShops: { label: "Sports & outdoor shops", categories: "commercial.outdoor_and_sport" },
      petShops: { label: "Pet shops", categories: "commercial.pet,pet.shop" },
      convenience: {
        label: "Convenience & newsagents",
        categories: "commercial.convenience,commercial.newsagent,commercial.kiosk",
      },
      babyGoods: { label: "Baby shops", categories: "commercial.baby_goods" },
    },
  },
  {
    group: "Beauty & wellbeing",
    types: {
      beauty: { label: "Hair & beauty salons", categories: "service.beauty,commercial.health_and_beauty.cosmetics" },
      barbers: { label: "Hairdressers & barbers", categories: "service.beauty.hairdresser" },
      spas: { label: "Spas & massage", categories: "service.beauty.spa,service.beauty.massage,leisure.spa" },
      gyms: { label: "Gyms & fitness studios", categories: "sport.fitness" },
    },
  },
  {
    group: "Health & care",
    types: {
      dentists: { label: "Dentists", categories: "healthcare.dentist" },
      clinics: { label: "Clinics & practices", categories: "healthcare.clinic_or_praxis" },
      pharmacies: {
        label: "Pharmacies, opticians & hearing",
        categories:
          "healthcare.pharmacy,commercial.health_and_beauty.pharmacy,commercial.health_and_beauty.optician,commercial.health_and_beauty.hearing_aids",
      },
      vets: { label: "Vets & pet care", categories: "pet.veterinary,pet.service" },
      nurseries: { label: "Nurseries & childcare", categories: "childcare" },
    },
  },
  {
    group: "Trades & services",
    types: {
      services: { label: "All services", categories: "service" },
      garages: { label: "Garages & car washes", categories: "service.vehicle.repair,service.vehicle.car_wash" },
      cleaning: { label: "Cleaners & laundrettes", categories: "service.cleaning" },
      tailors: { label: "Tailors & locksmiths", categories: "service.tailor,service.locksmith" },
      funerals: { label: "Funeral directors", categories: "service.funeral_directors" },
      taxis: { label: "Taxis", categories: "service.taxi" },
      estateAgents: { label: "Estate agents", categories: "service.estate_agent,office.estate_agent" },
      travelAgents: { label: "Travel agents", categories: "service.travel_agency,office.travel_agent" },
      drivingSchools: { label: "Driving schools", categories: "education.driving_school" },
      tuition: { label: "Music & language schools", categories: "education.music_school,education.language_school" },
    },
  },
  {
    group: "Professional offices",
    types: {
      offices: { label: "All offices", categories: "office" },
      solicitors: { label: "Solicitors", categories: "office.lawyer,office.notary" },
      accountants: {
        label: "Accountants & advisers",
        categories: "office.accountant,office.tax_advisor,office.financial_advisor",
      },
      insurance: { label: "Insurance brokers", categories: "office.insurance" },
      architects: { label: "Architects", categories: "office.architect" },
      agencies: {
        label: "IT, marketing & consultancies",
        categories: "office.it,office.advertising_agency,office.telecommunication,office.consulting",
      },
      recruitment: { label: "Recruitment agencies", categories: "office.employment_agency" },
      companies: { label: "Other companies", categories: "office.company,office.coworking" },
    },
  },
  {
    group: "Stay & leisure",
    types: {
      hotels: {
        label: "Hotels, B&Bs & guest houses",
        categories:
          "accommodation.hotel,accommodation.guest_house,accommodation.motel,accommodation.hostel,accommodation.apartment",
      },
      entertainment: {
        label: "Cinemas, bowling & escape rooms",
        categories:
          "entertainment.cinema,entertainment.bowling_alley,entertainment.escape_game,entertainment.amusement_arcade,entertainment.miniature_golf,entertainment.culture.theatre",
      },
      nightlife: { label: "Nightclubs", categories: "adult.nightclub" },
      venues: { label: "Sports centres & pools", categories: "sport.sports_centre,sport.swimming_pool" },
      rentals: { label: "Car & bike hire", categories: "rental.car,rental.bicycle" },
    },
  },
];

export const categoryMap: Record<string, string> = Object.fromEntries(
  businessTypes.flatMap((g) => Object.entries(g.types).map(([k, t]) => [k, t.categories])),
);

export const towns = [
  { group: "Around Ossett", places: ["Ossett", "Wakefield", "Horbury", "Dewsbury", "Batley", "Mirfield", "Morley", "Normanton"] },
  { group: "West Yorkshire", places: ["Leeds", "Bradford", "Huddersfield", "Halifax", "Brighouse", "Castleford", "Pontefract", "Pudsey", "Keighley", "Rothwell"] },
  { group: "Further afield", places: ["Barnsley", "Sheffield", "York", "Harrogate", "Doncaster", "Rotherham"] },
];
