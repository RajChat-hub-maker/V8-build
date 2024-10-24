
'use strict';

let hostrefs = {};
let hostsym = Symbol("hostref");
function hostref(s) {
  if (! (s in hostrefs)) hostrefs[s] = {[hostsym]: s};
  return hostrefs[s];
}
function eq_ref(x, y) {
  return x === y ? 1 : 0;
}

let spectest = {
  hostref: hostref,
  eq_ref: eq_ref,
  print: console.log.bind(console),
  print_i32: console.log.bind(console),
  print_i64: console.log.bind(console),
  print_i32_f32: console.log.bind(console),
  print_f64_f64: console.log.bind(console),
  print_f32: console.log.bind(console),
  print_f64: console.log.bind(console),
  global_i32: 666,
  global_i64: 666n,
  global_f32: 666.6,
  global_f64: 666.6,
  table: new WebAssembly.Table({initial: 10, maximum: 20, element: 'anyfunc'}),
  memory: new WebAssembly.Memory({initial: 1, maximum: 2})
};

let handler = {
  get(target, prop) {
    return (prop in target) ?  target[prop] : {};
  }
};
let registry = new Proxy({spectest}, handler);

function register(name, instance) {
  registry[name] = instance.exports;
}

function module(bytes, valid = true) {
  let buffer = new ArrayBuffer(bytes.length);
  let view = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; ++i) {
    view[i] = bytes.charCodeAt(i);
  }
  let validated;
  try {
    validated = WebAssembly.validate(buffer);
  } catch (e) {
    throw new Error("Wasm validate throws");
  }
  if (validated !== valid) {
    throw new Error("Wasm validate failure" + (valid ? "" : " expected"));
  }
  return new WebAssembly.Module(buffer);
}

function instance(bytes, imports = registry) {
  return new WebAssembly.Instance(module(bytes), imports);
}

function call(instance, name, args) {
  return instance.exports[name](...args);
}

function get(instance, name) {
  let v = instance.exports[name];
  return (v instanceof WebAssembly.Global) ? v.value : v;
}

function exports(instance) {
  return {module: instance.exports, spectest: spectest};
}

function run(action) {
  action();
}

function assert_malformed(bytes) {
  try { module(bytes, false) } catch (e) {
    if (e instanceof WebAssembly.CompileError) return;
  }
  throw new Error("Wasm decoding failure expected");
}

function assert_invalid(bytes) {
  try { module(bytes, false) } catch (e) {
    if (e instanceof WebAssembly.CompileError) return;
  }
  throw new Error("Wasm validation failure expected");
}

function assert_unlinkable(bytes) {
  let mod = module(bytes);
  try { new WebAssembly.Instance(mod, registry) } catch (e) {
    if (e instanceof WebAssembly.LinkError) return;
  }
  throw new Error("Wasm linking failure expected");
}

function assert_uninstantiable(bytes) {
  let mod = module(bytes);
  try { new WebAssembly.Instance(mod, registry) } catch (e) {
    if (e instanceof WebAssembly.RuntimeError) return;
  }
  throw new Error("Wasm trap expected");
}

function assert_trap(action) {
  try { action() } catch (e) {
    if (e instanceof WebAssembly.RuntimeError) return;
  }
  throw new Error("Wasm trap expected");
}

let StackOverflow;
try { (function f() { 1 + f() })() } catch (e) { StackOverflow = e.constructor }

function assert_exhaustion(action) {
  try { action() } catch (e) {
    if (e instanceof StackOverflow) return;
  }
  throw new Error("Wasm resource exhaustion expected");
}

function assert_return(action, ...expected) {
  let actual = action();
  if (actual === undefined) {
    actual = [];
  } else if (!Array.isArray(actual)) {
    actual = [actual];
  }
  if (actual.length !== expected.length) {
    throw new Error(expected.length + " value(s) expected, got " + actual.length);
  }
  for (let i = 0; i < actual.length; ++i) {
    switch (expected[i]) {
      case "nan:canonical":
      case "nan:arithmetic":
      case "nan:any":
        // Note that JS can't reliably distinguish different NaN values,
        // so there's no good way to test that it's a canonical NaN.
        if (!Number.isNaN(actual[i])) {
          throw new Error("Wasm return value NaN expected, got " + actual[i]);
        };
        return;
      case "ref.i31":
        if (typeof actual[i] !== "number" || (actual[i] & 0x7fffffff) !== actual[i]) {
          throw new Error("Wasm i31 return value expected, got " + actual[i]);
        };
        return;
      case "ref.any":
      case "ref.eq":
      case "ref.struct":
      case "ref.array":
        // For now, JS can't distinguish exported Wasm GC values,
        // so we only test for object.
        if (typeof actual[i] !== "object") {
          throw new Error("Wasm function return value expected, got " + actual[i]);
        };
        return;
      case "ref.func":
        if (typeof actual[i] !== "function") {
          throw new Error("Wasm function return value expected, got " + actual[i]);
        };
        return;
      case "ref.extern":
        if (actual[i] === null) {
          throw new Error("Wasm reference return value expected, got " + actual[i]);
        };
        return;
      case "ref.null":
        if (actual[i] !== null) {
          throw new Error("Wasm null return value expected, got " + actual[i]);
        };
        return;
      default:
        if (!Object.is(actual[i], expected[i])) {
          throw new Error("Wasm return value " + expected[i] + " expected, got " + actual[i]);
        };
    }
  }
}

// array_new_data.wast:1
let $1 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x8b\x80\x80\x80\x00\x02\x5e\x78\x01\x60\x02\x7f\x7f\x01\x64\x00\x03\x82\x80\x80\x80\x00\x01\x01\x07\x92\x80\x80\x80\x00\x01\x0e\x61\x72\x72\x61\x79\x2d\x6e\x65\x77\x2d\x64\x61\x74\x61\x00\x00\x0c\x81\x80\x80\x80\x00\x01\x0a\x90\x80\x80\x80\x00\x01\x8a\x80\x80\x80\x00\x00\x20\x00\x20\x01\xfb\x09\x00\x00\x0b\x0b\x87\x80\x80\x80\x00\x01\x01\x04\x61\x62\x63\x64");

// array_new_data.wast:12
assert_return(() => call($1, "array-new-data", [0, 0]), "ref.array");

// array_new_data.wast:13
assert_return(() => call($1, "array-new-data", [0, 4]), "ref.array");

// array_new_data.wast:14
assert_return(() => call($1, "array-new-data", [1, 2]), "ref.array");

// array_new_data.wast:15
assert_return(() => call($1, "array-new-data", [4, 0]), "ref.array");

// array_new_data.wast:18
assert_trap(() => call($1, "array-new-data", [0, 5]));

// array_new_data.wast:19
assert_trap(() => call($1, "array-new-data", [5, 0]));

// array_new_data.wast:20
assert_trap(() => call($1, "array-new-data", [1, 4]));

// array_new_data.wast:21
assert_trap(() => call($1, "array-new-data", [4, 1]));

// array_new_data.wast:24
let $2 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x89\x80\x80\x80\x00\x02\x5e\x78\x01\x60\x00\x02\x7f\x7f\x03\x82\x80\x80\x80\x00\x01\x01\x07\x9b\x80\x80\x80\x00\x01\x17\x61\x72\x72\x61\x79\x2d\x6e\x65\x77\x2d\x64\x61\x74\x61\x2d\x63\x6f\x6e\x74\x65\x6e\x74\x73\x00\x00\x0c\x81\x80\x80\x80\x00\x01\x0a\xa3\x80\x80\x80\x00\x01\x9d\x80\x80\x80\x00\x01\x01\x64\x00\x41\x01\x41\x02\xfb\x09\x00\x00\x21\x00\x20\x00\x41\x00\xfb\x0d\x00\x20\x00\x41\x01\xfb\x0d\x00\x0b\x0b\x87\x80\x80\x80\x00\x01\x01\x04\xaa\xbb\xcc\xdd");

// array_new_data.wast:38
assert_return(() => call($2, "array-new-data-contents", []), 187, 204);

// array_new_data.wast:40
let $3 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x88\x80\x80\x80\x00\x02\x5e\x7f\x01\x60\x00\x01\x7f\x03\x82\x80\x80\x80\x00\x01\x01\x07\xa0\x80\x80\x80\x00\x01\x1c\x61\x72\x72\x61\x79\x2d\x6e\x65\x77\x2d\x64\x61\x74\x61\x2d\x6c\x69\x74\x74\x6c\x65\x2d\x65\x6e\x64\x69\x61\x6e\x00\x00\x0c\x81\x80\x80\x80\x00\x01\x0a\x95\x80\x80\x80\x00\x01\x8f\x80\x80\x80\x00\x00\x41\x00\x41\x01\xfb\x09\x00\x00\x41\x00\xfb\x0b\x00\x0b\x0b\x87\x80\x80\x80\x00\x01\x01\x04\xaa\xbb\xcc\xdd");

// array_new_data.wast:53
assert_return(() => call($3, "array-new-data-little-endian", []), -573_785_174);

// array_new_data.wast:55
let $4 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x88\x80\x80\x80\x00\x02\x5e\x77\x01\x60\x00\x01\x7f\x03\x82\x80\x80\x80\x00\x01\x01\x07\x9c\x80\x80\x80\x00\x01\x18\x61\x72\x72\x61\x79\x2d\x6e\x65\x77\x2d\x64\x61\x74\x61\x2d\x75\x6e\x61\x6c\x69\x67\x6e\x65\x64\x00\x00\x0c\x81\x80\x80\x80\x00\x01\x0a\x95\x80\x80\x80\x00\x01\x8f\x80\x80\x80\x00\x00\x41\x01\x41\x01\xfb\x09\x00\x00\x41\x00\xfb\x0d\x00\x0b\x0b\x86\x80\x80\x80\x00\x01\x01\x03\x00\x11\x22");

// array_new_data.wast:68
assert_return(() => call($4, "array-new-data-unaligned", []), 8_721);
