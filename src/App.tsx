import { Route, Routes } from 'react-router-dom'

import Home from './components/Home'
import Servers from './components/Servers'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/servers" element={<Servers />} />
    </Routes>
  )
}

export default App
