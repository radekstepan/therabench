declare module 'virtual:results' {
  import type { ModelRun } from './types';
  const results: ModelRun[];
  export default results;
}

declare module 'virtual:questions' {
  import type { QuestionNode } from './types';
  const questions: QuestionNode[];
  export default questions;
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module '*.mustache?raw' {
  const template: string;
  export default template;
}
