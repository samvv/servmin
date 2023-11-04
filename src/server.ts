import { v4 as uuidv4 } from "uuid"
import { BehaviorSubject } from "rxjs";
import { PersonBase, Fallible, Status, MessageType, ValueType, warn } from "./common";
import path from "node:path"
import { Server as BunServer } from "bun"
import { write } from "node:console";

interface Person extends PersonBase {
  createdAt: Date;
  updatedAt: Date;
  password?: string;
}

interface Server {
  id: string;
  name: string;
  friendlyName?: string;
  description?: string;
  ownerId: string;
  ipv4?: string;
  ipv6?: string;
  status: Status;
  isPublic: boolean;
}

const servers: Server[] = [
  {
    id: 'd8ee4ce0-1830-4397-a6fc-da6134d6b77c',
    name: 'prometheus',
    ipv4: '192.168.129.5',
    friendlyName: 'Prometheus',
    ownerId: 'b10c1d74-00e8-4372-ac7b-0965d7e56ca6',
    status: Status.Online,
    isPublic: true,
  }
];

const persons: Person[] = [
  {
    id: 'b10c1d74-00e8-4372-ac7b-0965d7e56ca6',
    fullName: 'Sam Vervaeck',
    email: 'samvv@pm.me',
    password: 'blabla',
    createdAt: new Date('2023-10-03T19:37:43.884Z'),
    updatedAt: new Date('2023-10-03T19:37:43.884Z'),
  }
];

const E_INTERNAL_SERVER_ERROR = 'The server encountered an internal error.'
const E_EMAIL_OR_PASSWORD_INCORRECT = 'The given email address or password is incorrect.';

class APIError extends Error {}

export interface Sources {
  servers: Server[];
}

export type SourceName = keyof Sources;

export interface Methods {
  login(email: string, password: string): Fallible<Person>;
  addServer(server: Server): Fallible<Server>;
  listServers(): BehaviorSubject<Server[]>;
}

type AsyncMethods = { [K in keyof Methods]: (...args: Parameters<Methods[ K]>) => Promise<ReturnType<Methods[K]>> };

export class ClientHandler implements AsyncMethods {

  public constructor(
    private session: WSSession,
  ) {

  }

  async login(email: string, password: string): Promise<Fallible<Person>> {
    const person = persons.find(p => p.email === email);
    if (person === undefined || person.password === undefined || person.password !== password) {
      return { success: false, value: [ { message: E_EMAIL_OR_PASSWORD_INCORRECT } ] };
    }
    this.session.user = person;
    return { success: true, value: person };
  }

  async addServer(server: Server): Promise<Fallible<Server>> {
    server.id = uuidv4();
    servers.push(server);
    return { success: true, value: server };
  }

  async listServers() {
    const initValue = servers.filter(server => server.isPublic || (this.session.user !== null && server.ownerId === this.session.user.id));
    return new BehaviorSubject(initValue);
  }

  async logout() {
    this.session.user = null;
  }

}

const rootDir = path.resolve(import.meta.dir, '..');

const isDebug = true;

const devServerUrl = 'http://localhost:5173';

function notFound() {
  return new Response("Not Found", { status: 400 });
}

interface WSSession {
  user: Person | null;
}

export class HTTPServer {

  private server: BunServer;

  private nextSubjectId = 0;
  private activeSubjects = Object.create(null);

  private nextSubscriptionId = 0;
  private activeSubscriptions = Object.create(null);

  public constructor() {
    const self = this;
    this.server = Bun.serve<WSSession>({
      // cert: Bun.file('./config/localhost.crt'),
      // key: Bun.file('./config/localhost.key'),
      async fetch(req, server) {

        // Attempt to upgrade the request to the WebSocket protocol
        const success = server.upgrade(req, {
          data: { user: null }
        });

        if (success) {
          // Bun automatically returns a 101 Switching Protocols
          // if the upgrade succeeds
          return undefined;
        }

        const url = new URL(req.url);

        switch (url.pathname) {
          case '/fallback/call':
          {
            const { methodName, args } = await req.json();
            const handler = new ClientHandler({ user: null });
            const method = (handler as any)[methodName];
            if (method === undefined) {
              return new Response(JSON.stringify({ type: 'error', message: `Method '${methodName}' was not found.` }), { status: 500, headers: [ [ 'Access-Control-Allow-Origin', '*'] ] });
            }
            let value;
            try {
              value = await method.call(handler, ...args);
            } catch (error) {
              let message;
              if (error instanceof APIError) {
                message = error.message;
              } else {
                message = E_INTERNAL_SERVER_ERROR;
                console.error(error);
              }
              return new Response(JSON.stringify({ type: 'error', message }), { status: 500, headers: [ [ 'Access-Control-Allow-Origin', '*'] ] });
            }
            if (value instanceof BehaviorSubject) {
              const id = self.nextSubjectId++;
              self.activeSubjects[id] = value;
              value = { $type: ValueType.Subject, poll: 3, id, initValue: value.value };
            } else {
              value = { $type: ValueType.Plain, value };
            }
            return new Response(JSON.stringify({ type: 'success', value }), { headers: [ [ 'Access-Control-Allow-Origin', '*'] ] });
          }
          case '/fallback/poll':
          {
            const { id } = await req.json();
            const subject = self.activeSubjects[id];
            if (subject === undefined) {
              return new Response(JSON.stringify({ type: 'error', message: `Event stream with the given ID not found.` }), { headers: [ [ 'Access-Control-Allow-Origin', '*'] ] });
            }
            return new Response(JSON.stringify({ type: 'success', value: subject.value }), { headers: [ [ 'Access-Control-Allow-Origin', '*'] ] });
          }
        }

        // FIXME Disable proxying for now because we don't proxy WebSocket
        return;

        // Redirect to the devlopment server if one is active
        if (isDebug) {
          return fetch(devServerUrl + url.pathname + '?' + url.search);
        }

        // Serve files from disk
        const normalized = path.normalize(url.pathname);
        if (normalized.startsWith('..')) {
          return notFound();
        }
        const filePath = path.join(rootDir, normalized);
        let file = Bun.file(filePath);
        if (!await file.exists()) {
          file = Bun.file(path.join(rootDir, 'index.html'));
        }
        return new Response(file);
      },
      websocket: {
        // this is called when a message is received
        async message(ws, data) {

          const message = JSON.parse(data.toString());

          switch (message[0]) {

            case MessageType.SourceClose:
            {
              const [, subId] = message;
              self.activeSubscriptions[subId].unsubscribe();
              delete self.activeSubscriptions[subId];
              break;
            }

            case MessageType.MethodRequest:
            {
              const [, id, methodName, args] = message;
              const handler = new ClientHandler(ws.data);
              const method = (handler as any)[methodName];
              if (method === undefined) {
                ws.send(JSON.stringify([ MessageType.MethodFailure, id, `Method '${methodName}' was not found.` ]));
                break;
              }
              let value;
              try {
                value = await method.call(handler, ...args);
              } catch (error) {
                let message;
                if (error instanceof APIError) {
                  message = error.message;
                } else {
                  message = E_INTERNAL_SERVER_ERROR;
                  console.error(error);
                }
                ws.send(JSON.stringify([ MessageType.MethodFailure, id, message ]));
                break;
              }
              if (value instanceof BehaviorSubject) {
                const subId = self.nextSubscriptionId++;
                self.activeSubscriptions[subId] = value.subscribe(curr => {
                  ws.send(JSON.stringify([ MessageType.SourceNotify, curr ]));
                });
                value = [ ValueType.Subject, subId, value.value ];
              } else {
                value = [ ValueType.Plain, value ];
              }
              ws.send(JSON.stringify([ MessageType.MethodSuccess, id, value]));
              break;
            }

            default:
              warn(`MessageType not recognised.`);
              break;

          }

        },
      },
    });
  }

  public close(): void {
    this.server.stop(true);
  }

}

if (process.argv[1] === import.meta.path) {
  const server = new HTTPServer();
  console.log(`Application listening on port 3000`);
}
