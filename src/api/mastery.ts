// mastery.ts — dominio Mastery Store / Skill Tree (ADR-026)
import { fetchJSON } from './client'
import type {
  ConceptMastery,
  ConceptMasteryDetail,
  SkillTreeModule,
  CognitiveDebt,
  BiasData,
  SocraticResult,
} from '../types'

export function fetchMasteryAll(): Promise<{ concepts: ConceptMastery[]; count: number }> {
  return fetchJSON(`/api/study/mastery`)
}

export function fetchMasteryConcept(concept: string): Promise<{ data: ConceptMasteryDetail }> {
  return fetchJSON(`/api/study/mastery/${encodeURIComponent(concept)}`)
}

export function validateMasteryConcept(params: {
  concept: string
  score: number
  scoreType?: string
  sourceNote?: string
  sourceModule?: string
  details?: string
}): Promise<{ success: boolean; data: ConceptMastery }> {
  return fetch(`/api/study/mastery/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(r => r.json())
}

export function fetchSkillTree(): Promise<{ modules: SkillTreeModule[] }> {
  return fetchJSON(`/api/study/skill-tree`)
}

export function fetchCognitiveDebt(): Promise<{ data: CognitiveDebt }> {
  return fetchJSON(`/api/study/debt`)
}

export function fetchBiasData(): Promise<{ data: BiasData }> {
  return fetchJSON(`/api/study/bias`)
}

export function submitSocraticAudit(params: {
  concept: string
  operator_explanation: string
  source_note?: string
}): Promise<{ success: boolean; data: SocraticResult }> {
  return fetch(`/api/study/socratic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(r => r.json())
}
