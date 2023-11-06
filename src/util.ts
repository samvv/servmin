import { type BehaviorSubject } from "rxjs";

export function omit<O extends object, K extends keyof O>(obj: O, ...keys: K[]): Omit<O, K> {
  const newObj = {} as any;
  for (const [key, value] of Object.entries(obj)) {
    if (keys.indexOf(key as any) === -1) {
      newObj[key] = value;
    }
  }
  return newObj;
}

export class Deferred<T> {

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

export class SubjectResource<T> {

  public constructor(
    public subject: BehaviorSubject<T>,
    public close: () => void,
  ) {
 
  }

}

export function isChildOf(child: Node, parent: Node): boolean {
  for (;;) {
    if (child === parent) {
      return true;
    }
    if (child.parentNode === null) {
      return false;
    }
    child = child.parentNode;
  }
}

