declare module 'virtual:results' {
  import type { ModelRun } from './types';
  const results: ModelRun[];
  export default results;
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}
