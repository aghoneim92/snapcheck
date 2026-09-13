import { availableParallelism } from 'node:os';

/**
 * Half the logical CPUs, at least one. Deliberately conservative: concurrency
 * is itself a flake source, because parallel pages contend for CPU and GPU and
 * change paint timing. The determinism rig runs at this default, since it is
 * what users get.
 */
export function defaultConcurrency(): number {
  return Math.max(1, Math.floor(availableParallelism() / 2));
}

/** Runs `worker` over `items` with at most `concurrency` in flight, preserving order. */
export async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;

  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      // Sequential within a lane by design; the lanes are what run in parallel.
      // oxlint-disable-next-line no-await-in-loop
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(lanes);
  return results;
}
