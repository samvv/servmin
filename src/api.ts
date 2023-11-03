
import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils"
import { Fallible, MessageType, PersonBase, Server, ValueType, warn } from "./common";
import { BehaviorSubject, Subject } from "rxjs";
import { useForceUpdate } from "./hooks";
import type { Methods } from "./server"
import { useEffect, useRef, useState } from "react";

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

class APIClient {

  private socket = new WebSocket('ws://' + window.location.host);
  private nextMessageId = 0;

  private waitingUpdates: Record<string, Subject<any>> = Object.create(null);
  private waitingMethods: Record<string, Deferred<any>> = Object.create(null);

  public constructor(
  ) {
    this.socket.addEventListener('open', () => {
      console.log(`Established connection to server`);
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

  // public async connectToSource<K extends SourceName>(sourceName: K) {
  //   let id = this.nextMessageId++;
  //   this.socket.send(JSON.stringify([ MessageType.SourceRequest, id, sourceName ]));
  //   const subject = new Observable(subscriber => {
  //     this.waitingUpdates[id] = subscriber;
  //   });
  //   return { subject, close };
  // }

}

// const person = () => object({
//   id: string(),
//   fullName: string(),
//   email: string(),
// });

// export const authState = atom<Person | null>({
//   key: 'auth',
//   default: null,
//   effects: [
//     syncEffect({ refine: nullable(person()) }),
//   ],
// );

const client = new APIClient();

export const authAtom = atomWithStorage<Person | null>('auth', null);

type Unwrap<T>
  = T extends BehaviorSubject<infer R> ? R
  : T;

function useRemote<K extends keyof Methods>(client: APIClient, methodName: K, ...args: Parameters<Methods[K]>): Unwrap<ReturnType<Methods[K]>> | undefined {
  const [done, setDone] = useState(false);
  const resultRef = useRef<ReturnType<Methods[K]>>();
  const forceUpdate = useForceUpdate();
  useEffect(() => {
    if (done) {
      const result = resultRef.current;
      if (result instanceof SubjectResource) {
        const subscription = result.subject.subscribe(forceUpdate);
        return () => {
          subscription.unsubscribe();
          result.close();
          setDone(false);
        }
      }
    } else {
      client.call(methodName, ...args).then(value => {
        resultRef.current = value;
        setDone(true);
      });
    }
  }, [ done, resultRef.current ]);
  if (!done) {
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

