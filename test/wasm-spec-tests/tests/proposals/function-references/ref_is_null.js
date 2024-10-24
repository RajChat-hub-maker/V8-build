
'use strict';

let externrefs = {};
let externsym = Symbol("externref");
function externref(s) {
  if (! (s in externrefs)) externrefs[s] = {[externsym]: s};
  return externrefs[s];
}
function is_externref(x) {
  return (x !== null && externsym in x) ? 1 : 0;
}
function is_funcref(x) {
  return typeof x === "function" ? 1 : 0;
}
function eq_externref(x, y) {
  return x === y ? 1 : 0;
}
function eq_funcref(x, y) {
  return x === y ? 1 : 0;
}

let spectest = {
  externref: externref,
  is_externref: is_externref,
  is_funcref: is_funcref,
  eq_externref: eq_externref,
  eq_funcref: eq_funcref,
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

// ref_is_null.wast:1
let $1 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\xa1\x80\x80\x80\x00\x07\x60\x00\x00\x60\x01\x70\x01\x7f\x60\x01\x6f\x01\x7f\x60\x01\x63\x00\x01\x7f\x60\x00\x01\x7f\x60\x01\x6f\x00\x60\x01\x7f\x01\x7f\x03\x8b\x80\x80\x80\x00\x0a\x00\x01\x02\x03\x04\x05\x00\x06\x06\x06\x04\x8b\x80\x80\x80\x00\x03\x70\x00\x02\x6f\x00\x02\x63\x00\x00\x02\x07\xdd\x80\x80\x80\x00\x08\x07\x66\x75\x6e\x63\x72\x65\x66\x00\x01\x09\x65\x78\x74\x65\x72\x6e\x72\x65\x66\x00\x02\x08\x72\x65\x66\x2d\x6e\x75\x6c\x6c\x00\x04\x04\x69\x6e\x69\x74\x00\x05\x06\x64\x65\x69\x6e\x69\x74\x00\x06\x0c\x66\x75\x6e\x63\x72\x65\x66\x2d\x65\x6c\x65\x6d\x00\x07\x0e\x65\x78\x74\x65\x72\x6e\x72\x65\x66\x2d\x65\x6c\x65\x6d\x00\x08\x08\x72\x65\x66\x2d\x65\x6c\x65\x6d\x00\x09\x09\x92\x80\x80\x80\x00\x02\x00\x41\x01\x0b\x01\x00\x06\x02\x41\x01\x0b\x64\x00\x01\xd2\x00\x0b\x0a\xfe\x80\x80\x80\x00\x0a\x82\x80\x80\x80\x00\x00\x0b\x85\x80\x80\x80\x00\x00\x20\x00\xd1\x0b\x85\x80\x80\x80\x00\x00\x20\x00\xd1\x0b\x85\x80\x80\x80\x00\x00\x20\x00\xd1\x0b\x86\x80\x80\x80\x00\x00\xd0\x00\x10\x03\x0b\x88\x80\x80\x80\x00\x00\x41\x01\x20\x00\x26\x01\x0b\x94\x80\x80\x80\x00\x00\x41\x01\xd0\x70\x26\x00\x41\x01\xd0\x6f\x26\x01\x41\x01\xd0\x00\x26\x02\x0b\x88\x80\x80\x80\x00\x00\x20\x00\x25\x00\x10\x01\x0b\x88\x80\x80\x80\x00\x00\x20\x00\x25\x01\x10\x02\x0b\x88\x80\x80\x80\x00\x00\x20\x00\x25\x02\x10\x03\x0b");

// ref_is_null.wast:44
assert_return(() => call($1, "funcref", [null]), 1);

// ref_is_null.wast:45
assert_return(() => call($1, "externref", [null]), 1);

// ref_is_null.wast:46
assert_return(() => call($1, "ref-null", []), 1);

// ref_is_null.wast:48
assert_return(() => call($1, "externref", [externref(1)]), 0);

// ref_is_null.wast:50
run(() => call($1, "init", [externref(0)]));

// ref_is_null.wast:52
assert_return(() => call($1, "funcref-elem", [0]), 1);

// ref_is_null.wast:53
assert_return(() => call($1, "externref-elem", [0]), 1);

// ref_is_null.wast:54
assert_return(() => call($1, "ref-elem", [0]), 1);

// ref_is_null.wast:56
assert_return(() => call($1, "funcref-elem", [1]), 0);

// ref_is_null.wast:57
assert_return(() => call($1, "externref-elem", [1]), 0);

// ref_is_null.wast:58
assert_return(() => call($1, "ref-elem", [1]), 0);

// ref_is_null.wast:60
run(() => call($1, "deinit", []));

// ref_is_null.wast:62
assert_return(() => call($1, "funcref-elem", [0]), 1);

// ref_is_null.wast:63
assert_return(() => call($1, "externref-elem", [0]), 1);

// ref_is_null.wast:64
assert_return(() => call($1, "ref-elem", [0]), 1);

// ref_is_null.wast:66
assert_return(() => call($1, "funcref-elem", [1]), 1);

// ref_is_null.wast:67
assert_return(() => call($1, "externref-elem", [1]), 1);

// ref_is_null.wast:68
assert_return(() => call($1, "ref-elem", [1]), 1);

// ref_is_null.wast:71
let $2 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x93\x80\x80\x80\x00\x04\x60\x00\x00\x60\x01\x64\x00\x00\x60\x01\x64\x70\x00\x60\x01\x64\x6f\x00\x03\x84\x80\x80\x80\x00\x03\x01\x02\x03\x0a\xa2\x80\x80\x80\x00\x03\x86\x80\x80\x80\x00\x00\x20\x00\xd1\x1a\x0b\x86\x80\x80\x80\x00\x00\x20\x00\xd1\x1a\x0b\x86\x80\x80\x80\x00\x00\x20\x00\xd1\x1a\x0b");

// ref_is_null.wast:78
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x85\x80\x80\x80\x00\x01\x60\x01\x7f\x00\x03\x82\x80\x80\x80\x00\x01\x00\x0a\x8b\x80\x80\x80\x00\x01\x85\x80\x80\x80\x00\x00\x20\x00\xd1\x0b");

// ref_is_null.wast:82
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x03\x82\x80\x80\x80\x00\x01\x00\x0a\x89\x80\x80\x80\x00\x01\x83\x80\x80\x80\x00\x00\xd1\x0b");
