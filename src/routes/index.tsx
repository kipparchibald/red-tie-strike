import { createFileRoute } from "@tanstack/react-router";
import { EndlessRunner } from "@/components/EndlessRunner";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <EndlessRunner />;
}
