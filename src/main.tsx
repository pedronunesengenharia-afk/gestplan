import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Urbanist para interface e titulo, como manda a prancheta de marca. A
// variavel traz todos os pesos num arquivo so — sai mais leve que os tres
// arquivos estaticos que estavam aqui antes.
import '@fontsource-variable/urbanist'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './estilos/tokens.css'
import './estilos/app.css'
import './estilos/graficos.css'
import { App } from './App'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
