import GuiaNodePage, { nodeMetadata } from "./GuiaNodePage";

export const metadata = nodeMetadata("");

/** Portada e índice de la guía. El resto de las páginas viven en la raíz (app/[...slug]). */
export default function GuiaIndex() {
  return <GuiaNodePage slug="" />;
}
