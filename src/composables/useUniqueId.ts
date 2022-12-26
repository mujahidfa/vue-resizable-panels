import { ref } from "vue";
import type { Ref } from "vue";

const counter = ref(0);

export default function useUniqueId(id: string | null = null): Ref<string> {
  const idRef = ref<string | null>(id);
  if (idRef.value === null) {
    idRef.value = "" + counter.value++;
  }

  return idRef as Ref<string>;
}
