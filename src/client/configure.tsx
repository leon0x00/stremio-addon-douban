import { hydrateRoot } from "react-dom/client";
import { Configure, type ConfigureProps } from "@/components/configure";

const root = document.getElementById("configure");
const initialData = JSON.parse(document.getElementById("__INITIAL_DATA__")?.textContent || "{}") as ConfigureProps;

if (root) {
  hydrateRoot(root, <Configure {...initialData} />);
}
