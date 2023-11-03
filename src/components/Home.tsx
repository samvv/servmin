import Page from "./Page";
import Restricted from "./Restricted";

export default function Home() {
  return (
    <Restricted>
      <Page>
        Welcome to the dashboard
      </Page>
    </Restricted>
  );
}

