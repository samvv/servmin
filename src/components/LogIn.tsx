import { useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";

import { Heading } from "./Heading";
import { useSetRecoilState } from "recoil";
import { APIError, authState, login } from "../api";

function formatError(error: APIError): string {
  return error.message;
}

function processErrors(errors: APIError[]): [string[], Record<string, string[]>] {
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
  const setAuth = useSetRecoilState(authState);
  const [errors, setErrors] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const resetErrors = () => {
    setErrors([]);
  }
  const submit = async () => {
    const result = await login(email, password);
    if (result.success) {
      setAuth(result.value);
      resetErrors();
    } else {
      const [genericErrors, _fieldErrors] = processErrors(result.value);
      setErrors(genericErrors);
    }
  }
  return (
    <div className="min-h-screen flex justify-center">
      <div className="flex flex-col justify-center">
        <div className="flex max-w-md flex-col gap-4">
          <Heading>Log In</Heading>
          {errors.map(message => <div className="text-red-800">{message}</div>)}
          <div className="mb-2 block">
            <Label htmlFor="email">E-mail address</Label>
          </div>
          <TextInput required id="email" type="email" placeholder="Your email here ..." onInput={e => setEmail(e.currentTarget.value)}/>
          <div className="mb-2 block">
            <Label htmlFor="email">Password</Label>
          </div>
          <TextInput required id="password" type="password" placeholder="Your password here ..." onInput={e => setPassword(e.currentTarget.value)}/>
          <Button onClick={submit} type="submit">Log In</Button>
         </div>
      </div>
    </div>
  );
}

export default LogIn;
