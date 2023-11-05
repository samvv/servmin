
import { error, warn, info } from "./logger"
import { MessageType, ValueType } from "./common";
import { BehaviorSubject, Subject } from "rxjs";
import { MIN_POLL_TIMEOUT, WEBSOCKET_CONNECT_TIMEOUT } from "./constants";
import { Deferred, SubjectResource } from "./util";

export interface Client {
  call(methodName: string, ...args: any[]): Promise<any>;
}

export class HttpClient {

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

export class WebsocketClient {

  private nextMessageId = 0;

  private waitingUpdates: Record<string, Subject<any>> = Object.create(null);
  private waitingMethods: Record<string, Deferred<any>> = Object.create(null);

  public constructor(private socket: WebSocket) {

    this.socket.addEventListener('message', e => {

      const message = JSON.parse(e.data);

      if (!Array.isArray(message)) {
        error(`Could not parse WebSocket message: received JSON is not an array.`);
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

export function connectToWebsocket(url: string, {
  timeout = WEBSOCKET_CONNECT_TIMEOUT
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
      reject(new Error(`Failed to connect to WebSocket at ${url}`));
    }
    const onopen = () => {
      cleanup();
      info(`Successfully established WebSocket connection to ${url}`);
      accept(socket);
    }
    socket.addEventListener('open', onopen);
    socket.addEventListener('error', onerror);
  });
}

export async function createClient(): Promise<Client> {
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

