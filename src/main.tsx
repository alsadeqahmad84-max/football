import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PremierLeagueHub from './football'
import './styles.css'
import './football.css'
import './footballHero.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/football') ? <PremierLeagueHub /> : <App />}
  </React.StrictMode>,
)
