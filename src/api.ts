import { nullable, object, string } from "@recoiljs/refine";
import { atom, useRecoilValue } from "recoil";
import { syncEffect } from "recoil-sync";

const persons: RemotePerson[] = [
  {
    id: 'b10c1d74-00e8-4372-ac7b-0965d7e56ca6',
    fullName: 'Sam Vervaeck',
    email: 'samvv@pm.me',
    password: 'blabla',
    createdAt: new Date('2023-10-03T19:37:43.884Z'),
    updatedAt: new Date('2023-10-03T19:37:43.884Z'),
  }
];

export const enum Status {
  Online,
  Offline,
};

const servers: Server[] = [
  {
    name: 'prometheus',
    ipv4: '192.168.129.5',
    friendlyName: 'Prometheus',
    ownerId: 'b10c1d74-00e8-4372-ac7b-0965d7e56ca6',
    status: Status.Online,
    isPublic: false,
  }
];

const serverPermissions = [ 'view', 'power' ];

interface PersonBase {
  id: string;
  fullName: string;
  email: string;
}

export interface RemotePerson extends PersonBase {
  createdAt: Date;
  updatedAt: Date;
  password?: string;
}

export interface Person extends PersonBase {

}

export interface APIError {
  path?: (string | number)[];
  message: string;
}

export interface Server {
  name: string;
  friendlyName?: string;
  description?: string;
  ownerId: string;
  ipv4?: string;
  ipv6?: string;
  status: Status;
  isPublic: boolean;
}

const person = () => object({
  id: string(),
  fullName: string(),
  email: string(),
});

export const authState = atom<Person | null>({
  key: 'auth',
  default: null,
  effects: [
    syncEffect({ refine: nullable(person()) }),
  ],
});

type Success<T> = {
  success: true;
  value: T;
}

type Failure = {
  success: false,
  value: APIError[];
}

type APIResult<T> = Success<T> | Failure

const E_EMAIL_OR_PASSWORD_INCORRECT = 'The given email address or password is incorrect.';

export async function login(email: string, password: string): Promise<APIResult<Person>> {
  const person = persons.find(p => p.email === email);
  if (person === undefined || person.password === undefined || person.password !== password) {
    return { success: false, value: [ { message: E_EMAIL_OR_PASSWORD_INCORRECT } ] };
  }
  return { success: true, value: person };
}

export function useAuth(): Person | null {
  return useRecoilValue(authState);
}

export function useServers(): Server[] {
  const user = useAuth();
  return servers.filter(server => server.isPublic || (user !== null && server.ownerId === user.id));
}

