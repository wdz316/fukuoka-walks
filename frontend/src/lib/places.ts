// Localised city/place matching helpers.

const CITY_ALIASES: Record<string, string> = {
  tokyo: "tokyo",
  "東京": "tokyo",
  "东京": "tokyo",
  kyoto: "kyoto",
  "京都": "kyoto",
  osaka: "osaka",
  "大阪": "osaka",
  nara: "nara",
  "奈良": "nara",
  hokkaido: "hokkaido",
  "北海道": "hokkaido",
  okinawa: "okinawa",
  "沖縄": "okinawa",
  "冲绳": "okinawa",
  hiroshima: "hiroshima",
  "広島": "hiroshima",
  "广岛": "hiroshima",
  kanazawa: "kanazawa",
  "金沢": "kanazawa",
  "金泽": "kanazawa",
  fukuoka: "fukuoka",
  "福岡": "fukuoka",
  "福冈": "fukuoka",
  seoul: "seoul",
  "ソウル": "seoul",
  "首尔": "seoul",
  busan: "busan",
  "プサン": "busan",
  "釜山": "busan",
  taipei: "taipei",
  "台北": "taipei",
  beijing: "beijing",
  "北京": "beijing",
  shanghai: "shanghai",
  "上海": "shanghai",
  "hong kong": "hong kong",
  "香港": "hong kong",
};

export function normalizeCity(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ shi$/, "")
    .replace(/ city$/, "")
    .replace(/市$/, "");
}

export function canonicalCityAlias(name: string | null | undefined): string | null {
  const norm = normalizeCity(name);
  if (!norm) return null;
  const canonical = CITY_ALIASES[norm];
  return canonical ?? null;
}

export function isSameCity(a: string, b: string): boolean {
  const ca = canonicalCityAlias(a);
  const cb = canonicalCityAlias(b);
  if (ca != null && cb != null) return ca === cb;
  const na = normalizeCity(a);
  const nb = normalizeCity(b);
  return na.length > 0 && na === nb;
}

export function destinationNameMatches(destName: string, input: string): boolean {
  const q = normalizeCity(input);
  if (!q) return false;
  if (normalizeCity(destName) === q) return true;
  const qc = canonicalCityAlias(q);
  const dc = canonicalCityAlias(destName);
  return qc != null && dc != null && qc === dc;
}