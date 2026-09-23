<script lang="ts">
  import { createDevtools } from "@priemskiyyy/flare-devtools/svelte";

  const devtools = createDevtools();
</script>

<div {@attach devtools}></div>
