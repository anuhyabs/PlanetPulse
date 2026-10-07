import { loadPlaces, norm } from './model.js';

// The chosen place survives tab changes (this module is shared by every page).
export const PLACE = { cur: null, km: 100 };

let placesP = null;
export function getPlaces(db) {
  if (!placesP) {
    placesP = loadPlaces(db).then((list) => {
      for (const p of list) { p._a = norm(p.ascii); p._b = norm(p.name); p._c = norm(p.country + ' ' + p.admin1 + ' ' + p.cc); }
      return list;
    }).catch((e) => { placesP = null; throw e; });
  }
  return placesP;
}

export async function loadFresh(db) {
  const r = await db.rows('SELECT max(run_at) AS m FROM lsrc');
  const ms = r[0] && r[0].m ? Date.parse(r[0].m) : NaN;
  return Number.isFinite(ms) ? ms : null;
}
