declare global {
  interface Document {
    activeDragOperation: DragOperation | undefined;
  }
}

export {};
