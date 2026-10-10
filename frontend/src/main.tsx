import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { HintProvider } from './components/Hint'
import './index.css'
import './fx.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HintProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </HintProvider>
  </StrictMode>,
)
