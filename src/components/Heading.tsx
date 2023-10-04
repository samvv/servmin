
export interface HeadingProps {
  level?: number;
  children: React.ReactNode;
}

export function Heading({ level = 1, ...props }: HeadingProps) {
  let C: React.ElementType;
  switch (level) {
    case 1:
      C = 'h1';
      break;
    case 2:
      C = 'h2';
      break;
    case 3:
      C = 'h3';
      break;
    case 4:
      C = 'h4';
      break;
    default:
      return;
  }
  return <C className="font-bold text-lg" {...props} />
}
