import { Label, TextInput } from "flowbite-react";
import { useEffect, useId, useRef, useState } from "react";
import { useForceUpdate } from "../hooks";
import { isChildOf } from "../util";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Choice {
  id: string;
  keywords: string[];
  element: React.ReactNode;
}

export type MatchFn = (pattern: string, maxCount: number) => Choice[] | Promise<Choice[]>;

export interface SelectFieldProps {
  label?: React.ReactNode;
  match: MatchFn;
  maxMatches?: number;
  required?: boolean;
  onUpdate?: (choiceId: string | null) => void;
}

export function matchFromArray(array: Choice[]): MatchFn {
  return (pattern: string, maxCount: number) => {
    const matches = [];
    const regex = new RegExp(escapeRegExp(pattern), 'i');
    for (const choice of array) {
      if (choice.keywords.some(kw => regex.test(kw))) {
        matches.push(choice);
      }
      if (matches.length === maxCount) {
        break;
      }
    }
    return matches;
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

type SuggestionProps = React.HTMLProps<HTMLDivElement> & { selected: boolean };

function Suggestion({ selected, ...props }: SuggestionProps) {
  let className = "p-4 cursor-pointer hover:bg-gray-300"
  const elementRef = useRef<HTMLDivElement>(null);
  if (selected) {
    className += ' bg-gray-200';
  } else {
    className += ' bg-white';
  }
  useEffect(() => {
    const element = elementRef.current;
    if (selected && element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ selected ]);
  return <div ref={elementRef} className={className} {...props} />
}

export function SelectField({ label, match, required, onUpdate, maxMatches = 5 }: SelectFieldProps) {
  const id = useId();
  const forceUpdate = useForceUpdate();
  const wrapperRef = useRef(null);
  const matches = useRef<Choice[]>([]);
  const selected = useRef<Choice | null>(null);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [pattern, setPattern] = useState('');
  const select = (choice: Choice | null) => {
    selected.current = choice;
    setIndex(0);
    forceUpdate();
    if (onUpdate !== undefined) {
      onUpdate(choice ? choice.id : null);
    }
  }
  useEffect(() => {
    (async () => {
      matches.current = await match(pattern, maxMatches);
      forceUpdate();
    })();
  }, [ pattern ]);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper === null) {
      return;
    }
    const cb = (e: MouseEvent) => {
      if (!isChildOf(e.target as HTMLElement, wrapper)) {
        window.removeEventListener('mousedown', cb);
        setFocused(false);
      }
    }
    window.addEventListener('mousedown', cb);
  });
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (index >= matches.current.length) {
          break;
        }
        select(matches.current[index]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (matches.current.length === 0) {
          break;
        }
        setIndex(mod(index-1, matches.current.length));
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (matches.current.length === 0) {
          break;
        }
        setIndex(mod(index+1, matches.current.length));
        break;
    }
  }
  let matchesClassName = 'absolute overflow-y-auto max-h-[20rem] w-full border-2 border-t-0';
  if (!focused) {
    matchesClassName += ' hidden';
  }
  return (
    <div ref={wrapperRef} className="">
      <Label htmlFor={id}>{label}</Label>
      {selected.current
        ? <div className="bg-blue-200 p-4 cursor-pointer" onClick={() => { select(null); setFocused(true) }}>{selected.current.element}</div>
        : <div className="relative z-50">
            <TextInput id={id} autoFocus={focused} onInput={e => setPattern(e.currentTarget.value)} onKeyDown={onKeyDown} onFocus={() => setFocused(true)} />
            <div className={matchesClassName}>
              {matches.current.map((choice, i) => 
                <Suggestion key={choice.id} selected={i === index} onClick={() => { select(choice); setFocused(false) }}>{choice.element}</Suggestion>)}
            </div>
          </div>
      }
    </div>
  );
}

