import { useState, useCallback } from 'react'
import en from './en'
import rw from './rw'
import type { TranslationKey } from './en'

export type Lang = 'en' | 'rw'

const STORAGE_KEY = 'cycletrack_lang'
const translations = { en, rw }

function getSavedLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'en' || saved === 'rw' ? saved : 'rw'
}

export function useTranslation() {
  const [lang, setLangState] = useState<Lang>(getSavedLang)

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback(
    (key: TranslationKey) => translations[lang][key] as string,
    [lang],
  )

  return { lang, setLang, t }
}
