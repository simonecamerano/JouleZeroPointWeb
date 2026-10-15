// Effetti continui: il motore li interroga quando calcola un valore o controlla una mossa (spec 1C, 4.2).
import { StatoPartita } from '../engine/types';
import { Vieto } from './dsl';

export function vietato(_s: StatoPartita, _v: Vieto): boolean {
  return false;
}
