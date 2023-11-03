import { Link, LinkProps, matchPath, useLocation, useMatch } from "react-router-dom";
import { useAuth } from "../api";
import { useState } from "react";

function merge(...classNames: (string | undefined)[]): string {
  return classNames.join(' ');
}

function NavBarLink({ to, className, ...props }: LinkProps) {
  const active = useMatch(to + '/*' as string);
  return <Link to={to} className={merge(className, "font-bold block no-underline p-3 transition-colors", active ? "bg-gray-500" : "hover:bg-gray-300")} {...props} />;
}

function MenuLink({ to, className, ...props }: LinkProps) {
  const active = useMatch(to as string);
  return <Link to={to} className={merge(className, "block no-underline p-3 w-full", active ? "bg-gray-300" : "bg-gray-200 hover:bg-gray-400")} {...props} />;
}

function SidebarLink({ match, to, className, ...props }: LinkProps & { match: string[] }) {
  const location = useLocation();
  let active = false;
  for (const pattern of match) {
    if (matchPath(pattern, location.pathname)) {
      active = true;
    }
  }
  return <Link to={to} className={merge(className, "block no-underline p-2", active ? "bg-gray-300" : "bg-gray-200 hover:bg-gray-400")} {...props} />;
}

export interface PageProps {
  children: React.ReactNode;
}

export function Page({ children }: PageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const person = useAuth();
  let menu;
  if (menuOpen) {
    menu = (
      <div className="absolute right-0">
        <MenuLink to="/profile/edit">Edit Profile</MenuLink>
        <MenuLink to="/logout">Log Out</MenuLink>
      </div>
    );
  }
  let links;
  if (person !== null) {
    links = (
      <div className="relative" onMouseOver={() => setMenuOpen(true)} onMouseOut={() => setMenuOpen(false)}>
        <NavBarLink to="/profile">{person.fullName}</NavBarLink>
        {menu}
      </div>
    );
  } else {
    links = (
      <>
        <NavBarLink to="/login">Log In</NavBarLink>
      </>
    );
  }
  return (
    <>
      <header className="bg-gray-400 flex">
        <NavBarLink to="/">Home</NavBarLink>
        <div className="flex-1" />
        {links}
      </header>
      <div className="flex flex-wrap">
        <div className="min-h-screen bg-gray-200 min-w-[10rem]">
          <SidebarLink to="/servers" match={['/servers', '/server/*']}>Servers</SidebarLink>
        </div>
        <main className="p-5">{children}</main>
      </div>
    </>
  );
}

export default Page;
