/* ── StudyNest core types ─────────────────────────────────────────── */

export type NodeKind = 'subject' | 'chapter' | 'topic' | 'subtopic' | 'folder'
export type ItemCategory = 'note' | 'question' | 'practice'
export type ItemKind = 'file' | 'snapshot' | 'text'
export type FileKind = 'pdf' | 'image' | 'text'
export type ReviewState = 'new' | 'learning' | 'review' | 'relearning'
export type Rating = 1 | 2 | 3 | 4 // 1 Again · 2 Hard · 3 Good · 4 Easy

/** A folder in the study tree: subject → chapter → topic → subtopic, plus free custom folders */
export interface StudyNode {
  id: string
  parentId: string | null // null only for subjects
  kind: NodeKind
  name: string
  color: string // hex, used for subject tab + accents
  icon?: string
  description?: string
  createdAt: number
  updatedAt: number
}

/** Any stored study material: uploaded file, in-app text note, or a cropped snapshot */
export interface StudyItem {
  id: string
  nodeId: string
  kind: ItemKind
  category: ItemCategory
  name: string
  fileKind: FileKind
  mime?: string
  size: number
  blobKey?: string // key into blobs store (pdf / image / snapshot)
  textContent?: string // for text notes
  sourceFileId?: string // snapshot origin
  sourcePage?: number
  starred?: boolean
  createdAt: number
  updatedAt: number
}

/** Spaced-repetition record attached to an item */
export interface ReviewItem {
  id: string
  itemId: string
  ease: number
  interval: number // days (0 = in-session learning step)
  reps: number
  lapses: number
  state: ReviewState
  due: number // timestamp
  lastReviewed: number | null
  suspended?: boolean
  createdAt: number
}

export interface ReviewLogEntry {
  id: string
  itemId: string
  date: number
  rating: Rating
  prevInterval: number
  nextInterval: number
  timeSpent: number // seconds
}

export interface Settings {
  notificationsEnabled: boolean
  reminderTime: string // "HH:MM"
  dailyLimit: number // max reviews per session (0 = unlimited)
  theme: 'paper' | 'night'
  lastReminderCheck: number
  onboarded: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: false,
  reminderTime: '18:00',
  dailyLimit: 0,
  theme: 'paper',
  lastReminderCheck: 0,
  onboarded: false,
}

export const SUBJECT_PALETTE = [
  '#c65953', // notebook red
  '#d98e32', // amber
  '#7d9a4a', // moss
  '#4f8f7b', // teal
  '#8b6fae', // plum
  '#c96f9b', // rose
  '#a5763f', // caramel
  '#5f8bb0', // slate blue
]

export const CATEGORY_META: Record<
  ItemCategory,
  { label: string; plural: string; color: string; soft: string }
> = {
  note: { label: 'Note', plural: 'Notes', color: '#d9a441', soft: '#faf0d7' },
  question: { label: 'Question', plural: 'Questions', color: '#e07b39', soft: '#fbe8d8' },
  practice: { label: 'Practice sheet', plural: 'Practice Sheets', color: '#8b6fae', soft: '#efe8f7' },
}

export const KIND_META: Record<NodeKind, { label: string; plural: string }> = {
  subject: { label: 'Subject', plural: 'Subjects' },
  chapter: { label: 'Chapter', plural: 'Chapters' },
  topic: { label: 'Topic', plural: 'Topics' },
  subtopic: { label: 'Subtopic', plural: 'Subtopics' },
  folder: { label: 'Folder', plural: 'Folders' },
}

/** default child kind when creating inside a node kind */
export const SUGGESTED_CHILD: Record<NodeKind, NodeKind | null> = {
  subject: 'chapter',
  chapter: 'topic',
  topic: 'subtopic',
  subtopic: 'folder',
  folder: 'folder',
}
