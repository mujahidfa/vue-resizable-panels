import { ref } from "vue";
import type { Ref } from "vue";

let counter = 0;

export default function useUniqueId(id: string | null = null): Ref<string> {
  const idRef = ref<string | null>(id);
  if (idRef.value === null) {
    idRef.value = "" + counter++;
  }

  return idRef as Ref<string>;
}
