import { useAuth } from "../client";
import LogIn from "./LogIn";

export interface RestrictedProps {
  children: React.ReactNode;
  permissions?: string[];
}

export function Restricted({ children, permissions = [] }: RestrictedProps): React.ReactNode {
  const user = useAuth();
  if (user === null) {
    return <LogIn />;
  }
  return (
    <>{children}</>
  );
}

export default Restricted;
