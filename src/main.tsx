import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './components/App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'jotai'

const isDebug = import.meta.env.DEV;

let element = (
  <BrowserRouter>
    <Provider>
      <App />
    </Provider>
  </BrowserRouter>
);

if (isDebug) {
  element = (
    <React.StrictMode>
      {element}
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(element);

