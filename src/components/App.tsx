import { Route, Routes, useNavigate } from 'react-router-dom'

import Home from './Home'
import Servers from './Servers'
import NotFound from './NotFound'
import { useEffect } from 'react'
import { authAtom, logout, useShowMessage, useMessages, useHideMessage } from '../api'
import { useSetAtom } from 'jotai'
import LogIn from './LogIn'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons'

function App() {
  return (
    <>
      <Errors />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/logout" element={<LogOut />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

function Errors() {
  const messages = useMessages();
  const hideMessage = useHideMessage();
  return (
    <div className='z-50 absolute right-0'>
      {messages.map(message => {
        const color = message.type === 'error' ? 'bg-red-400' : 'bg-blue-400';
        return (
          <div key={message.id} className={`flex items-center p-4 m-4 ${color} text-white min-w-[50%]`}>
            {message.text}
            <FontAwesomeIcon className="p-2 cursor-pointer" icon={faCircleXmark} onClick={() => hideMessage(message.id)} />
          </div>
        );
      })}
    </div>
  );
}

function LogOut() {
  const navigate = useNavigate();
  const showMessage = useShowMessage();
  const setAuth = useSetAtom(authAtom);
  useEffect(() => {
    logout()
      .then(() => {
        setAuth(null);
        navigate('/');
      })
      .catch(() => {
        showMessage({ text: `Could not log out from remote server.`, type: 'error' });
        setAuth(null);
        navigate('/');
      });
  });
  return (
    <p>Logging out ...</p>
  );
}

export default App
