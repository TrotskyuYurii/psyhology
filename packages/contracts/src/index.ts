export interface PublicTest { id: string; title: string; category: string; desc: string; label: string; version: number; questions: string[] }
export interface TestResult { id: string; version?: number; raw: number; percent: number; date: string }
export interface SubmitAnswers { answers: number[]; version: number }
export interface Draft { answers: number[]; index: number }
export interface LocalData { history: TestResult[]; drafts: Record<string, Draft> }
