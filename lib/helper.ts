export function fibonacciBackoffDelay(n: number, maxDelay?: number): number {
  if (maxDelay === 0 || n < 1) return 0;
  if (n <= 2) return 1;
  let fn2 = 1;
  let fn1 = 1;
  let fn = 2;
  for (let i = 3; i <= n; i++) {
    fn = fn1 + fn2;
    if (maxDelay && fn > maxDelay) return maxDelay;
    fn2 = fn1;
    fn1 = fn;
  }
  return fn;
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
