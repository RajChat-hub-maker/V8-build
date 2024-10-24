
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
      default:
        if (!Object.is(actual[i], expected[i])) {
          throw new Error("Wasm return value " + expected[i] + " expected, got " + actual[i]);
        };
    }
  }
}

// imports3.wast:1
let $1 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x9e\x80\x80\x80\x00\x07\x60\x00\x00\x60\x01\x7f\x00\x60\x01\x7d\x00\x60\x00\x01\x7f\x60\x00\x01\x7d\x60\x01\x7f\x01\x7f\x60\x01\x7e\x01\x7e\x03\x88\x80\x80\x80\x00\x07\x00\x01\x02\x03\x04\x05\x06\x04\x88\x80\x80\x80\x00\x02\x70\x00\x0a\x70\x01\x0a\x14\x05\x86\x80\x80\x80\x00\x02\x00\x02\x01\x02\x04\x06\x94\x80\x80\x80\x00\x03\x7f\x00\x41\x37\x0b\x7d\x00\x43\x00\x00\x30\x42\x0b\x7e\x01\x42\xc2\x00\x0b\x07\xba\x81\x80\x80\x00\x0e\x04\x66\x75\x6e\x63\x00\x00\x08\x66\x75\x6e\x63\x2d\x69\x33\x32\x00\x01\x08\x66\x75\x6e\x63\x2d\x66\x33\x32\x00\x02\x09\x66\x75\x6e\x63\x2d\x3e\x69\x33\x32\x00\x03\x09\x66\x75\x6e\x63\x2d\x3e\x66\x33\x32\x00\x04\x0d\x66\x75\x6e\x63\x2d\x69\x33\x32\x2d\x3e\x69\x33\x32\x00\x05\x0d\x66\x75\x6e\x63\x2d\x69\x36\x34\x2d\x3e\x69\x36\x34\x00\x06\x0a\x67\x6c\x6f\x62\x61\x6c\x2d\x69\x33\x32\x03\x00\x0a\x67\x6c\x6f\x62\x61\x6c\x2d\x66\x33\x32\x03\x01\x0e\x67\x6c\x6f\x62\x61\x6c\x2d\x6d\x75\x74\x2d\x69\x36\x34\x03\x02\x0c\x74\x61\x62\x6c\x65\x2d\x31\x30\x2d\x69\x6e\x66\x01\x00\x0b\x74\x61\x62\x6c\x65\x2d\x31\x30\x2d\x32\x30\x01\x01\x0c\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x69\x6e\x66\x02\x00\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x01\x0a\xbd\x80\x80\x80\x00\x07\x82\x80\x80\x80\x00\x00\x0b\x82\x80\x80\x80\x00\x00\x0b\x82\x80\x80\x80\x00\x00\x0b\x84\x80\x80\x80\x00\x00\x41\x16\x0b\x87\x80\x80\x80\x00\x00\x43\x00\x00\x30\x41\x0b\x84\x80\x80\x80\x00\x00\x20\x00\x0b\x84\x80\x80\x80\x00\x00\x20\x00\x0b");

// imports3.wast:18
register("test", $1)

// imports3.wast:19
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xa5\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x04\x74\x65\x73\x74\x08\x66\x75\x6e\x63\x2d\x69\x33\x32\x02\x00\x01");

// imports3.wast:26
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xa7\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x04\x74\x65\x73\x74\x0a\x67\x6c\x6f\x62\x61\x6c\x2d\x69\x33\x32\x02\x00\x01");

// imports3.wast:33
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xa9\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x04\x74\x65\x73\x74\x0c\x74\x61\x62\x6c\x65\x2d\x31\x30\x2d\x69\x6e\x66\x02\x00\x01");

// imports3.wast:40
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xaa\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x08\x73\x70\x65\x63\x74\x65\x73\x74\x09\x70\x72\x69\x6e\x74\x5f\x69\x33\x32\x02\x00\x01");

// imports3.wast:47
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xab\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x08\x73\x70\x65\x63\x74\x65\x73\x74\x0a\x67\x6c\x6f\x62\x61\x6c\x5f\x69\x33\x32\x02\x00\x01");

// imports3.wast:54
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xa6\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x08\x73\x70\x65\x63\x74\x65\x73\x74\x05\x74\x61\x62\x6c\x65\x02\x00\x01");

// imports3.wast:62
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xa7\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x08\x73\x70\x65\x63\x74\x65\x73\x74\x06\x6d\x65\x6d\x6f\x72\x79\x02\x00\x02");

// imports3.wast:69
assert_unlinkable("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\xa8\x80\x80\x80\x00\x02\x04\x74\x65\x73\x74\x0a\x6d\x65\x6d\x6f\x72\x79\x2d\x32\x2d\x34\x02\x00\x01\x08\x73\x70\x65\x63\x74\x65\x73\x74\x06\x6d\x65\x6d\x6f\x72\x79\x02\x01\x01\x01");
