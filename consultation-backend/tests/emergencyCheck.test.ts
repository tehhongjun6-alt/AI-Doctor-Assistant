import { describe, expect, it } from 'vitest'
import { checkEmergencyRisk } from '../src/safety/emergencyCheck.js'

describe('emergencyCheck - Malay emergency keywords (Step 3 / A13)', () => {
  it('detects chest pain in Malay (sakit dada)', () => {
    const result = checkEmergencyRisk('Saya rasa sakit dada yang sangat kuat')
    expect(result.isEmergency).toBe(true)
    expect(result.category).toBe('chest_pain')
  })

  it('detects breathing emergencies in Malay (tak boleh bernafas / sesak nafas teruk)', () => {
    const result1 = checkEmergencyRisk('Tolong, saya tak boleh bernafas sekarang')
    expect(result1.isEmergency).toBe(true)
    expect(result1.category).toBe('breathing')

    const result2 = checkEmergencyRisk('Pesakit mengalami sesak nafas teruk')
    expect(result2.isEmergency).toBe(true)
    expect(result2.category).toBe('breathing')
  })

  it('detects self-harm and suicide in Malay (bunuh diri / nak mati)', () => {
    const result1 = checkEmergencyRisk('Saya nak bunuh diri')
    expect(result1.isEmergency).toBe(true)
    expect(result1.category).toBe('self_harm')

    const result2 = checkEmergencyRisk('Rasa putus asa, saya nak mati')
    expect(result2.isEmergency).toBe(true)
    expect(result2.category).toBe('self_harm')
  })

  it('detects stroke symptoms in Malay (mulut senget / cakap pelat tiba-tiba)', () => {
    const result1 = checkEmergencyRisk('Muka dan mulut senget sebelah')
    expect(result1.isEmergency).toBe(true)
    expect(result1.category).toBe('stroke')

    const result2 = checkEmergencyRisk('Nenek cakap pelat tiba-tiba dan tangan lemah')
    expect(result2.isEmergency).toBe(true)
    expect(result2.category).toBe('stroke')
  })

  it('detects seizures in Malay (sawan)', () => {
    const result = checkEmergencyRisk('Budak ini tiba-tiba sawan')
    expect(result.isEmergency).toBe(true)
    expect(result.category).toBe('seizure')
  })

  it('detects overdose and poisoning in Malay (telan banyak ubat / minum racun)', () => {
    const result1 = checkEmergencyRisk('Dia telan banyak ubat panadol tadi')
    expect(result1.isEmergency).toBe(true)
    expect(result1.category).toBe('poisoning_overdose')

    const result2 = checkEmergencyRisk('Kanak-kanak terminum racun serangga')
    expect(result2.isEmergency).toBe(true)
    expect(result2.category).toBe('poisoning_overdose')
  })

  it('detects severe bleeding in Malay (darah tak berhenti)', () => {
    const result = checkEmergencyRisk('Luka kena pisau, darah tak berhenti')
    expect(result.isEmergency).toBe(true)
    expect(result.category).toBe('severe_bleeding')
  })

  it('detects unconsciousness in Malay (pengsan / tak sedar diri)', () => {
    const result1 = checkEmergencyRisk('Kawan saya tiba-tiba pengsan')
    expect(result1.isEmergency).toBe(true)
    expect(result1.category).toBe('unconsciousness')

    const result2 = checkEmergencyRisk('Dia terbaring dan tak sedar diri')
    expect(result2.isEmergency).toBe(true)
    expect(result2.category).toBe('unconsciousness')
  })

  it('does not falsely trigger emergency for mild non-urgent symptoms in Malay', () => {
    const result = checkEmergencyRisk('Saya demam biasa dan batuk sikit sejak semalam')
    expect(result.isEmergency).toBe(false)
  })

  it('preserves existing Chinese and English emergency triggers', () => {
    const chinese = checkEmergencyRisk('胸口剧烈压榨性疼痛')
    expect(chinese.isEmergency).toBe(true)
    expect(chinese.category).toBe('chest_pain')

    const english = checkEmergencyRisk('Severe crushing chest pain')
    expect(english.isEmergency).toBe(true)
    expect(english.category).toBe('chest_pain')
  })
})
