import type { EmergencyCategory } from '../safety/emergencyCheck.js'

export type MedicalDataCategory =
  | 'greeting'
  | 'symptom'
  | 'medication'
  | 'disease'
  | 'injury'
  | 'test_result'
  | 'treatment'
  | 'general_health'
  | 'unknown'

export type MedicalDataRoute =
  | 'emergency'
  | 'direct_model'
  | 'medical_qa'
  | 'medical_api'
  | 'clarification'

export interface MedicalDataRouteResult {
  route: MedicalDataRoute
  category: MedicalDataCategory
  reason: string
  searchQuery?: string
  searchQueries?: string[]
  isEmergency?: boolean
  emergencyCategory?: EmergencyCategory
  emergencyReason?: string
}
