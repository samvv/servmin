
import { useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils"
import { Fallible, MessageType, PersonBase, Server, ValueType, error, info, warn } from "./common";
import { BehaviorSubject, Subject } from "rxjs";
import { useForceUpdate } from "./hooks";
import type { Methods } from "./server"
import { useEffect, useRef, useState } from "react";
import { MIN_POLL_TIMEOUT } from "./constants";
import { log } from "node:console";

export interface Person extends PersonBase {

}

class Deferred<T> {

  promise: Promise<T>;
  accept!: (value: T) => void;
  reject!: (error: Error) => void;

  public constructor() {
    this.promise = new Promise((accept, reject) => {
      this.accept = accept;
      this.reject = reject;
    });
  }

}

class SubjectResource<T> {

  public constructor(
    public subject: BehaviorSubject<T>,
    public close: () => void,
  ) {
 
  }

}

interface Client {
  call(methodName: string, ...args: any[]): Promise<any>;
}

class HttpClient {

  public constructor(private url: string) {

  }

  public async call(methodName: string, ...args: any[]): Promise<any> {
    const response = await fetch(this.url + '/call', { method: 'POST', body: JSON.stringify({ methodName, args }) });
    if (response.status !== 200) {
      throw new Error(`Request resulted in response status ${response.status}, which is not 200`);
    }
    const data = await response.json();
    if (data.type === 'error') {
      throw new Error(data.message);
    }
    const rawValue = data.value;
    if (rawValue.$type === ValueType.Subject) {
      const { id, poll, initValue } = rawValue;
      const timeout = Math.max(MIN_POLL_TIMEOUT, poll);
      let timer: Timer;
      const subject = new BehaviorSubject(initValue);
      const loop = async () => {
        const response = await fetch(this.url + '/poll', { method: 'POST', body: JSON.stringify({ id }) });
        const data = await response.json();
        if (data.type === 'error') {
          error(data.message)
        } else {
          subject.next(data.value);
        }
        timer = setTimeout(loop, timeout);
      }
      timer = setTimeout(loop, timeout);
      const close = () => {
        /// TODO notify server that resource is closed
        clearTimeout(timer);
      }
      return new SubjectResource(subject, close);
    }
    return rawValue.value;
  }

}

class WebsocketClient {

  private nextMessageId = 0;

  private waitingUpdates: Record<string, Subject<any>> = Object.create(null);
  private waitingMethods: Record<string, Deferred<any>> = Object.create(null);

  public constructor(private socket: WebSocket) {
    this.socket.addEventListener('open', () => {
      info(`Established connection to server`);
    });
    this.socket.addEventListener('message', e => {
      const message = JSON.parse(e.data);
      if (!Array.isArray(message)) {
        return;
      }
      switch (message[0]) {
        case MessageType.SourceNotify:
        {
          const [, id, value] = message;
          const subject = this.waitingUpdates[id];
          if (subject === undefined) {
            break;
          }
          subject.next(value);
          break;
        }
        case MessageType.MethodSuccess:
        {
          const [, id, rawValue] = message;
          const value = this.decodeValue(rawValue)
          const deferred = this.waitingMethods[id];
          deferred.accept(value);
          break;
        }
        case MessageType.MethodFailure:
        {
          const [, id, error] = message;
          const deferred = this.waitingMethods[id];
          deferred.reject(new Error(error));
          break;
        }
      }
    });
  }

  private decodeValue(data: any): any {
    if (!Array.isArray(data)) {
      warn(`Could not decode value: value is not an array`);
      return;
    }
    switch (data[0]) {
      case ValueType.Plain:
        return data[1];
      case ValueType.Subject:
        const [, id, initValue] = data;
        const subject = new BehaviorSubject(initValue);
        this.waitingUpdates[id] = subject;
        const close = () => {
          this.socket.send(JSON.stringify([MessageType.SourceClose, id]));
          delete this.waitingUpdates[id];
          subject.complete();
        }
        return new SubjectResource(subject, close);
    }
  }

  public call(methodName: string, ...args: any[]): Promise<any> {
    let id = this.nextMessageId++;
    this.socket.send(JSON.stringify([ MessageType.MethodRequest, id, methodName, args ]));
    const deferred = new Deferred();
    this.waitingMethods[id] = deferred;
    return deferred.promise;
  }

}

function connectToWebsocket(url: string, {
  timeout = 5000
} = {}): Promise<WebSocket> {
  const socket = new WebSocket(url);
  return new Promise((accept, reject) => {
    const cleanup = () => {
      socket.removeEventListener('open', onopen);
      socket.removeEventListener('error', onerror);
      clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`WebSocket connection timeout exceeded.`));
    }, timeout);
    const onerror = () => {
      cleanup();
      reject(new Error(`Failed to connect to ${url}`));
    }
    const onopen = () => {
      cleanup();
      accept(socket);
    }
    socket.addEventListener('open', onopen);
    socket.addEventListener('error', onerror);
  });
}

async function createClient(): Promise<Client> {
  return new HttpClient(window.location.protocol + '//' + window.location.hostname + ':3000/fallback');
  // FIXME Re-enable this in production
  // let socket;
  // try {
  //   socket = await connectToWebsocket('wss://' + window.location.hostname + ':3000');
  // } catch (error) {
  //   return new HttpClient(window.location.protocol + '//' + window.location.hostname + ':3000/fallback');
  // }
  // return new WebsocketClient(socket);
}

const client = await createClient();

export const authAtom = atomWithStorage<Person | null>('auth', null);

type Unwrap<T>
  = T extends BehaviorSubject<infer R> ? R
  : T;

enum Mode {
  Init,
  Waiting,
  Done,
}

function useRemote<K extends keyof Methods>(client: Client, methodName: K, ...args: Parameters<Methods[K]>): Unwrap<ReturnType<Methods[K]>> | undefined {
  const [status, setStatus] = useState(Mode.Init);
  const resultRef = useRef<ReturnType<Methods[K]>>();
  const forceUpdate = useForceUpdate();
  useEffect(() => {
    switch (status) {
      case Mode.Done:
        const result = resultRef.current;
        if (result instanceof SubjectResource) {
          const subscription = result.subject.subscribe(forceUpdate);
          return () => {
            subscription.unsubscribe();
            result.close();
            setStatus(Mode.Init);
          }
        }
        break;
      case Mode.Waiting:
        break;
      case Mode.Init:
        client.call(methodName, ...args).then(value => {
          resultRef.current = value;
          setStatus(Mode.Done);
        });
        setStatus(Mode.Waiting);
        break;
    }
  }, [ status ]);
  if (status === Mode.Init) {
    return undefined;
  }
  if (resultRef.current instanceof SubjectResource) {
    // @ts-ignore Collision with Unwrap
    return resultRef.current.subject.value;
  }
  // @ts-ignore Collision with Unwrap
  return resultRef.current;
}

export function useAuth(): Person | null {
  return useAtomValue(authAtom);
}

export async function login(email: string, password: string): Promise<Fallible<Person>> {
  return client.call('login', email, password);
}

export async function logout(): Promise<void> {
  return client.call('logout');
}

export function useServers(): Server[] {
  return useRemote(client, 'listServers') ?? [];
}

