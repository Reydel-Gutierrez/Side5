import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { MockAppProvider } from './context/MockAppContext'
import './styles/variables.css'
import './styles/global.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MockAppProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MockAppProvider>
  </StrictMode>,
)
