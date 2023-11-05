import { useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";

import { Heading } from "./Heading";
import { Diagnostic } from "../common";
import { authAtom, login, useShowMessage } from "../api";
import { useSetAtom } from "jotai";
import { useLocation, useNavigate } from "react-router-dom";

function formatError(error: Diagnostic): string {
  return error.message;
}

function processErrors(errors: Diagnostic[]): [string[], Record<string, string[]>] {
  const genericErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};
  for (const error of errors) {
    const message = formatError(error);
    if (error.path === undefined) {
      genericErrors.push(message);
    } else {
      const key = error.path.join('.');
      if (!(key in errors)) {
        fieldErrors[key] = [];
      }
      fieldErrors[key].push(message);
    }
  }
  return [genericErrors, fieldErrors];
}

export function LogIn() {
  const setAuth = useSetAtom(authAtom);
  const location = useLocation();
  const navigate = useNavigate();
  const showMessage = useShowMessage();
  const [errors, setErrors] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [disabled, setDisabled] = useState(false);
  const reset = () => {
    setErrors([]);
    setDisabled(false);
  }
  const submit = async () => {
    setDisabled(true);
    const result = await login(email, password);
    if (result.success) {
      setAuth(result.value);
      showMessage({
        text: `You are now logged in as ${result.value.fullName}`,
        type: 'info',
      });
      reset();
      if (location.pathname === '/login') {
        navigate('/');
      }
    } else {
      const [genericErrors, _fieldErrors] = processErrors(result.value);
      setErrors(genericErrors);
      setDisabled(false);
    }
  }
  return (
    <div className="min-h-screen flex justify-center">
      <div className="flex flex-col justify-center">
        <form className="flex max-w-md flex-col gap-4" onSubmit={e => { e.preventDefault(); submit(); }}>
          <Heading>Log In</Heading>
          {errors.map((message, i) => <div key={i} className="text-red-800">{message}</div>)}
          <div className="mb-2 block">
            <Label htmlFor="email">E-mail address</Label>
          </div>
          <TextInput required id="email" type="email" placeholder="Your email here ..." onInput={e => setEmail(e.currentTarget.value)}/>
          <div className="mb-2 block">
            <Label htmlFor="email">Password</Label>
          </div>
          <TextInput required id="password" type="password" placeholder="Your password here ..." onInput={e => setPassword(e.currentTarget.value)}/>
          <Button disabled={disabled} type="submit">Log In</Button>
         </form>
      </div>
    </div>
  );
}

export default LogIn;
