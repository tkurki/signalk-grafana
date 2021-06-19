export default class ValidatingBuffer<T> {
  validate: (values: T[]) => boolean;
  callback: (t?: T) => void;
  buffer: T[];
  constructor(validate: (values: T[]) => boolean, callback: (t?: T) => void) {
    this.validate = validate;
    this.callback = callback;
    this.buffer = [] as T[];
  }

  push(t: T) {
    if (this.buffer.length === 3) {
      this.callback(this.buffer.pop());
    }
    if (this.buffer.length === 2 && !this.validate([t].concat(this.buffer))) {
      this.buffer.shift();
    }
    this.buffer.unshift(t);
  }

  flush() {
    if (this.buffer.length === 3) {
      const isMiddleValid = this.validate(this.buffer);
      if (isMiddleValid) {
        this.callback(this.buffer.pop());
      }
    }
  }
}
