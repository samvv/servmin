import { Link } from "react-router-dom";
import { useServers } from "../api";
import Page from "./Page";
import Restricted from "./Restricted";

export default function Servers() {
  const servers = useServers();
  console.log(servers);
  return (
    <Restricted permissions={['server.view']}>
      <Page>
        {servers.map(server => (
          <div key={server.name} className="p-5">
            <Link to={`/server/${server.name}`}>{server.friendlyName}</Link>
          </div>
        ))}
      </Page>
    </Restricted>
  );
}

