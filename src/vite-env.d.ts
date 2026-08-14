/// <reference types="vite/client" />

// CSS module declaration
declare module '*.css' {
  const content: string;
  export default content;
}
