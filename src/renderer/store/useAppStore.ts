import { create } from 'zustand'
import type { AppState, PanelView } from '@shared/types'

type Store = {
  state: AppState | null
  view: PanelView
  openSection: string | null // settings page to open directly (e.g. "accounts")
  setView: (view: PanelView, section?: string) => void
  init: () => () => void
}

export const useAppStore = create<Store>((set) => ({
  state: null,
  view: 'home',
  openSection: null,
  setView: (view, section) => set({ view, openSection: section ?? null }),
  init: () => {
    window.api.getState().then((state) => set({ state }))
    const offState = window.api.onState((state) => set({ state }))
    const offNav = window.api.onNavigate((view) => set({ view, openSection: null }))
    return () => {
      offState()
      offNav()
    }
  }
}))
