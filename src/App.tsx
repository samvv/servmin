import { Route, Routes, useNavigate } from 'react-router-dom'

import Home from './components/Home'
import Servers from './components/Servers'
import NotFound from './components/NotFound'
import { useEffect } from 'react'
import { authAtom, logout } from './api'
import { useSetAtom } from 'jotai'
import LogIn from './components/LogIn'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/servers" element={<Servers />} />
      <Route path="/login" element={<LogIn />} />
      <Route path="/logout" element={<LogOut />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function LogOut() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  useEffect(() => {
    logout().then(() => {
      setAuth(null);
      navigate('/');
    });
  });
  return (
    <p>Logging out ...</p>
  );
}

export default App
