<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  export let newProjectName = '';
  export let newProjectWidth = 64;
  export let newProjectHeight = 64;
  export let newProjectBg = 'transparent';
  export let newProjectPassword = '';
  export let importedFileName = '';
</script>

