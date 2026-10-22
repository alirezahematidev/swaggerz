<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import Tasks from './Tasks.svelte';

  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } });
</script>

<QueryClientProvider client={queryClient}>
  <Tasks />
</QueryClientProvider>
