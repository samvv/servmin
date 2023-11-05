import { Link } from "react-router-dom";
import { useServers } from "../api";
import Page from "./Page";
import Restricted from "./Restricted";
import { Button } from "flowbite-react";

export default function Servers() {
  const servers = useServers();
  console.log(servers);
  return (
    <Restricted permissions={['server.view']}>
      <Page>
        <Button as={Link} className="inline-block my-4" to="/servers/new">Add server</Button>
        {servers.map(server => (
          <div key={server.name} className="p-5 bg-gray-300 hover:bg-gray-200">
            <Link to={`/server/${server.name}`}>{server.friendlyName}</Link>
          </div>
        ))}
      </Page>
    </Restricted>
  );
}

