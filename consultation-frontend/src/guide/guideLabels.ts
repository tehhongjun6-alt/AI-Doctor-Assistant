import type { Translation } from '../i18n'
import type { GuideCategory } from './guideTypes'

export const GUIDE_CATEGORIES: GuideCategory[] = ['infection', 'chronic', 'everyday', 'emergency']

export function categoryLabel(t: Translation, category: GuideCategory) {
  switch (category) {
    case 'infection':
      return t.guideCatInfection
    case 'chronic':
      return t.guideCatChronic
    case 'everyday':
      return t.guideCatEveryday
    case 'emergency':
      return t.guideCatEmergency
  }
}
