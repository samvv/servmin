
export function info(message: string): void {
  console.info(message);
}

export function warn(message: string): void {
  console.warn(message);
}

export function error(message: string): void {
  console.error(message);
}

export interface Diagnostic {
  path?: (string | number)[];
  message: string;
}

export type Success<T> = {
  success: true;
  value: T;
}

export type Failure = {
  success: false,
  value: Diagnostic[];
}

export type Fallible<T> = Success<T> | Failure

export interface PersonBase {
  id: string;
  fullName: string;
  email: string;
}

export const enum Status {
  Online,
  Offline,
};

export const permissions = [
  'server.view',
  'server.power',
];

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

export const enum MessageType {
  MethodRequest,
  MethodFailure,
  MethodSuccess,
  SourceClose,
  SourceNotify,
}

export const enum ValueType {
  Plain,
  Subject,
}
