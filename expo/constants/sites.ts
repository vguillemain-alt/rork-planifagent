import { SiteKey } from '@/types/planning';

export interface SiteConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const SITES: Record<SiteKey, SiteConfig> = {
  PAV_B: {
    label: 'PAV B',
    color: '#F97316',
    bgColor: '#FFF3E0',
    textColor: '#E65100',
  },
  PAV_A: {
    label: 'PAV A',
    color: '#2196F3',
    bgColor: '#E3F2FD',
    textColor: '#0D47A1',
  },
  ALTO_DEPOT: {
    label: 'ALTO Dépôt',
    color: '#E91E9C',
    bgColor: '#FCE4EC',
    textColor: '#880E4F',
  },
  ALTO_AGENCE: {
    label: 'ALTO Agence',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    textColor: '#1B5E20',
  },
  MULTI_SERVICES: {
    label: 'Multi-services',
    color: '#FBC02D',
    bgColor: '#FFFDE7',
    textColor: '#F57F17',
  },
  PIEL: {
    label: 'PIEL',
    color: '#8B5CF6',
    bgColor: '#F3E8FF',
    textColor: '#5B21B6',
  },
  GOUGEUL: {
    label: 'GOUGEUL',
    color: '#0D9488',
    bgColor: '#CCFBF1',
    textColor: '#115E59',
  },
  COSNEAU: {
    label: 'COSNEAU',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    textColor: '#991B1B',
  },
  COISNARD: {
    label: 'COISNARD',
    color: '#0891B2',
    bgColor: '#CFFAFE',
    textColor: '#155E75',
  },
};

export const SITE_KEYS: SiteKey[] = [
  'PAV_B',
  'PAV_A',
  'ALTO_DEPOT',
  'ALTO_AGENCE',
  'MULTI_SERVICES',
  'PIEL',
  'GOUGEUL',
  'COSNEAU',
  'COISNARD',
];

export const DAY_LABELS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'];
export const DAY_SHORT = ['LUN', 'MAR', 'MER', 'JEU', 'VEN'];
