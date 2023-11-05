import { useEffect, useState, useRef } from "react";
import { BehaviorSubject } from "rxjs";
import type { Methods } from "./server"
import { v4 as uuidv4 } from "uuid"
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils"
import { Client, createClient } from "./client";
import { Fallible, PersonBase, Server } from "./common";
import { SubjectResource, omit } from "./util";
import { MESSAGE_DURATION } from "./constants";
import { useForceUpdate } from "./hooks";

export interface Person extends PersonBase {

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

  const showMessage = useShowMessage();
  const forceUpdate = useForceUpdate();

  const [mode, setMode] = useState(Mode.Init);

  const resultRef = useRef<ReturnType<Methods[K]>>();

  useEffect(() => {

    switch (mode) {

      case Mode.Done:

        const result = resultRef.current;
        if (result instanceof SubjectResource) {
          const subscription = result.subject.subscribe(forceUpdate);
          return () => {
            subscription.unsubscribe();
            result.close();
            setMode(Mode.Init);
          }
        }
        break;

      case Mode.Waiting:
        break;

      case Mode.Init:
        client.call(methodName, ...args)
          .catch(() => {
            console.log('HRE');
            showMessage(`Failed to send a request to the server.`);
          })
          .then(value => {
            resultRef.current = value;
            setMode(Mode.Done);
          });
        setMode(Mode.Waiting);
        break;

    }
  }, [ mode ]);

  if (mode === Mode.Init) {
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
  try {
    return await client.call('login', email, password);
  } catch (error) {
    return { success: false, value: [ { message: `Failed to send a request to the server.` } ] };
  }
}

export async function logout(): Promise<void> {
  return client.call('logout');
}

export function useServers(): Server[] {
  return useRemote(client, 'listServers') ?? [];
}

const messagesAtom = atom<Record<string, Message>>({});

export type MessageType = 'error' | 'info';

export interface Message {
  type: MessageType;
  id: string;
  text: string;
}

interface ShowMessageOptions {
  type?: MessageType;
  text: string;
  duration?: number;
}

export type ShowMessageFn = (opts: ShowMessageOptions) => void;

export function useShowMessage(): ShowMessageFn {
  const setMessages = useSetAtom(messagesAtom);
  return ({
    text,
    type = 'error',
    duration = MESSAGE_DURATION,
  }: ShowMessageOptions) => {
    const id = uuidv4();
    setMessages(messages => ({ ...messages, [id]: { type, id, text } }));
    if (duration != Infinity) {
      setTimeout(() => {
        setMessages(messages => omit(messages, id));
      }, duration);
    }
  };
}

export type HideMessageFn = (id: string) => void;

export function useHideMessage(): HideMessageFn { 
  const setMessages = useSetAtom(messagesAtom);
  return (id: string) => {
    setMessages(messages => omit(messages, id));
  }
}

export function useMessages(): Message[] {
  return Object.values(useAtomValue(messagesAtom));
}

