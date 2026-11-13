/**
 * Comprehensive Bangalore Tech Hubs, Corridors, Metro Stations & Localities Dataset
 * Provides instant, zero-latency autocomplete with precise coordinates and Place IDs,
 * covering all residential societies, IT hubs, and key junctions across Bangalore.
 */
export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  lat: number;
  lng: number;
}

export const BANGALORE_HUBS: PlaceSuggestion[] = [
  // Tech Parks & IT Corridors
  {
    placeId: 'blr_manyata_01',
    primaryText: 'Manyata Tech Park',
    secondaryText: 'Nagavara, Hebbal, Outer Ring Road, Bangalore',
    lat: 13.0500,
    lng: 77.6200,
  },
  {
    placeId: 'blr_ecospace_02',
    primaryText: 'EcoSpace / EcoWorld Business Park',
    secondaryText: 'Bellandur, Outer Ring Road, Bangalore',
    lat: 12.9260,
    lng: 77.6762,
  },
  {
    placeId: 'blr_prestige_tech_03',
    primaryText: 'Prestige Tech Park (Cessna / JP Morgan)',
    secondaryText: 'Kadubeesanahalli, Marathahalli-Sarjapur ORR, Bangalore',
    lat: 12.9360,
    lng: 77.6910,
  },
  {
    placeId: 'blr_bagmane_tech_04',
    primaryText: 'Bagmane Tech Park',
    secondaryText: 'CV Raman Nagar, Byrasandra, Bangalore',
    lat: 12.9800,
    lng: 77.6600,
  },
  {
    placeId: 'blr_bagmane_constellation_05',
    primaryText: 'Bagmane Constellation Business Park',
    secondaryText: 'K R Puram / Doddanekundi, Bangalore',
    lat: 12.9890,
    lng: 77.7010,
  },
  {
    placeId: 'blr_itpl_whitefield_06',
    primaryText: 'ITPL / International Tech Park Whitefield',
    secondaryText: 'Whitefield Main Road, Bangalore',
    lat: 12.9856,
    lng: 77.7314,
  },
  {
    placeId: 'blr_electronic_city_ph1_07',
    primaryText: 'Electronic City Phase 1 (Infosys / Wipro / HP)',
    secondaryText: 'Hosur Road, Bangalore',
    lat: 12.8452,
    lng: 77.6602,
  },
  {
    placeId: 'blr_electronic_city_ph2_08',
    primaryText: 'Electronic City Phase 2 (TCS / Tech Mahindra)',
    secondaryText: 'Hosur Road, Bangalore',
    lat: 12.8390,
    lng: 77.6770,
  },
  {
    placeId: 'blr_embassy_golf_links_10',
    primaryText: 'Embassy Golf Links (EGL / Microsoft / IBM)',
    secondaryText: 'Challaghatta, Intermediate Ring Road, Domlur, Bangalore',
    lat: 12.9520,
    lng: 77.6480,
  },
  {
    placeId: 'blr_rmz_infinity_11',
    primaryText: 'RMZ Infinity (Google / Old Madras Road)',
    secondaryText: 'Bennigana Halli, Bangalore',
    lat: 12.9930,
    lng: 77.6610,
  },
  {
    placeId: 'blr_global_tech_village_09',
    primaryText: 'Global Village Tech Park',
    secondaryText: 'Mylasandra, Mysore Road / RR Nagar, Bangalore',
    lat: 12.9150,
    lng: 77.5020,
  },
  {
    placeId: 'blr_rmz_ecoworld_13',
    primaryText: 'RMZ EcoWorld (Campus 30 / Honeywell / Morgan Stanley)',
    secondaryText: 'Devarabeesanahalli, Bellandur, Bangalore',
    lat: 12.9230,
    lng: 77.6840,
  },
  {
    placeId: 'blr_divyasree_technopolis_14',
    primaryText: 'Divyasree Technopolis (Deloitte / EY)',
    secondaryText: 'Yemalur, HAL Airport Road, Bangalore',
    lat: 12.9460,
    lng: 77.6850,
  },
  {
    placeId: 'blr_brigade_tech_gardens_15',
    primaryText: 'Brigade Tech Gardens',
    secondaryText: 'Brookefield, Kundalahalli, Bangalore',
    lat: 12.9720,
    lng: 77.7180,
  },

  // Key Bangalore Neighborhoods & Hubs
  {
    placeId: 'blr_koramangala_16',
    primaryText: 'Koramangala (Sony World Signal / Forum)',
    secondaryText: 'Hosur Road / Inner Ring Road, Bangalore',
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    placeId: 'blr_hsr_layout_17',
    primaryText: 'HSR Layout (BDA Complex / Sector 1-7)',
    secondaryText: 'Outer Ring Road, Bangalore',
    lat: 12.9121,
    lng: 77.6446,
  },
  {
    placeId: 'blr_indiranagar_18',
    primaryText: 'Indiranagar (100 Feet Road / 12th Main)',
    secondaryText: 'Old Airport Road / CMH Road, Bangalore',
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    placeId: 'blr_bellandur_gate_19',
    primaryText: 'Bellandur Central Signal',
    secondaryText: 'Sarjapur Main Road / Outer Ring Road, Bangalore',
    lat: 12.9280,
    lng: 77.6740,
  },
  {
    placeId: 'blr_sarjapur_road_20',
    primaryText: 'Sarjapur Road (Wipro Corporate Office)',
    secondaryText: 'Doddakannelli, Carmelaram, Bangalore',
    lat: 12.9100,
    lng: 77.6980,
  },
  {
    placeId: 'blr_marathahalli_21',
    primaryText: 'Marathahalli Bridge',
    secondaryText: 'HAL Old Airport Road / Outer Ring Road, Bangalore',
    lat: 12.9550,
    lng: 77.7010,
  },
  {
    placeId: 'blr_whitefield_hope_farm_22',
    primaryText: 'Whitefield (Hope Farm Junction / Forum Shantiniketan)',
    secondaryText: 'Channasandra Main Road, Bangalore',
    lat: 12.9830,
    lng: 77.7520,
  },
  {
    placeId: 'blr_hebbal_flyover_23',
    primaryText: 'Hebbal Flyover / Esteem Mall',
    secondaryText: 'Bellary Road / Airport Road, Bangalore',
    lat: 13.0360,
    lng: 77.5970,
  },
  {
    placeId: 'blr_silk_board_24',
    primaryText: 'Central Silk Board Junction',
    secondaryText: 'Hosur Road / Outer Ring Road, BTM Layout, Bangalore',
    lat: 12.9177,
    lng: 77.6238,
  },
  {
    placeId: 'blr_btm_layout_25',
    primaryText: 'BTM Layout (Udupi Garden / 2nd Stage)',
    secondaryText: 'Bannerghatta Road, Bangalore',
    lat: 12.9166,
    lng: 77.6101,
  },
  {
    placeId: 'blr_jayanagar_26',
    primaryText: 'Jayanagar (4th Block Complex)',
    secondaryText: 'South Bangalore, Karnataka',
    lat: 12.9250,
    lng: 77.5838,
  },
  {
    placeId: 'blr_mg_road_27',
    primaryText: 'MG Road / Trinity Circle',
    secondaryText: 'Central Business District, Bangalore',
    lat: 12.9756,
    lng: 77.6066,
  },
  {
    placeId: 'blr_kalyan_nagar_28',
    primaryText: 'Kalyan Nagar / HRBR Layout',
    secondaryText: 'Kammanahalli, Outer Ring Road, Bangalore',
    lat: 13.0180,
    lng: 77.6430,
  },
  {
    placeId: 'blr_banashankari_29',
    primaryText: 'Banashankari (BDA Complex / Bus Station)',
    secondaryText: 'Outer Ring Road, Kanakapura Road, Bangalore',
    lat: 12.9180,
    lng: 77.5730,
  },
  {
    placeId: 'blr_electronic_city_toll_30',
    primaryText: 'Electronic City Elevated Tollway Entrance',
    secondaryText: 'Hosur Road, Roopena Agrahara, Bangalore',
    lat: 12.9090,
    lng: 77.6320,
  },

  // Society Reference
  {
    placeId: 'blr_hosa_road_12',
    primaryText: 'Mahaveer Ranches (Clubhouse Main Gate)',
    secondaryText: 'Hosa Road, Off Hosur Road, Bangalore',
    lat: 12.8715,
    lng: 77.6534,
  },
];

/**
 * Coordinates for a place saved by name only (e.g. a work location picked
 * when the map lookup was unavailable): matches the built-in list of hubs.
 */
export function findKnownPlace(name: string | undefined): PlaceSuggestion | null {
  const target = (name ?? '').trim().toLowerCase();
  if (!target) return null;
  return (
    BANGALORE_HUBS.find((p) => p.primaryText.toLowerCase() === target) ??
    // A longer name that starts with a hub's name (e.g. "Manyata Tech Park, Hebbal")
    (target.length >= 6 ? BANGALORE_HUBS.find((p) => target.startsWith(p.primaryText.toLowerCase())) : undefined) ??
    null
  );
}
