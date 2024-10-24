
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

// table.wast:3
let $1 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x00");

// table.wast:4
let $2 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x01");

// table.wast:5
let $3 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x85\x80\x80\x80\x00\x01\x70\x01\x00\x00");

// table.wast:6
let $4 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x85\x80\x80\x80\x00\x01\x70\x01\x00\x01");

// table.wast:7
let $5 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x86\x80\x80\x80\x00\x01\x70\x01\x01\x80\x02");

// table.wast:8
let $6 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x87\x80\x80\x80\x00\x01\x70\x01\x00\x80\x80\x04");

// table.wast:9
let $7 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x89\x80\x80\x80\x00\x01\x70\x01\x00\xff\xff\xff\xff\x0f");

// table.wast:11
let $8 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x01");

// table.wast:12
let $9 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x6f\x00\x01");

// table.wast:13
let $10 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x04\x85\x80\x80\x80\x00\x01\x63\x00\x00\x01");

// table.wast:15
let $11 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x87\x80\x80\x80\x00\x02\x70\x00\x00\x70\x00\x00");

// table.wast:16
let $12 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x02\x94\x80\x80\x80\x00\x01\x08\x73\x70\x65\x63\x74\x65\x73\x74\x05\x74\x61\x62\x6c\x65\x01\x70\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x00");

// table.wast:18
let $13 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x00");

// table.wast:19
let $14 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x01");

// table.wast:20
let $15 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x84\x80\x80\x80\x00\x01\x70\x00\x01");

// table.wast:22
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x09\x86\x80\x80\x80\x00\x01\x00\x41\x00\x0b\x00");

// table.wast:23
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x03\x82\x80\x80\x80\x00\x01\x00\x09\x87\x80\x80\x80\x00\x01\x00\x41\x00\x0b\x01\x00\x0a\x88\x80\x80\x80\x00\x01\x82\x80\x80\x80\x00\x00\x0b");

// table.wast:26
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x85\x80\x80\x80\x00\x01\x70\x01\x01\x00");

// table.wast:30
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x89\x80\x80\x80\x00\x01\x70\x01\xff\xff\xff\xff\x0f\x00");

// table.wast:35
assert_malformed("\x3c\x6d\x61\x6c\x66\x6f\x72\x6d\x65\x64\x20\x71\x75\x6f\x74\x65\x3e");

// table.wast:39
assert_malformed("\x3c\x6d\x61\x6c\x66\x6f\x72\x6d\x65\x64\x20\x71\x75\x6f\x74\x65\x3e");

// table.wast:43
assert_malformed("\x3c\x6d\x61\x6c\x66\x6f\x72\x6d\x65\x64\x20\x71\x75\x6f\x74\x65\x3e");

// table.wast:48
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x89\x80\x80\x80\x00\x01\x40\x00\x70\x00\x01\x41\x00\x0b");

// table.wast:52
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x8a\x80\x80\x80\x00\x01\x40\x00\x64\x70\x00\x01\xd0\x6f\x0b");

// table.wast:56
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x04\x8a\x80\x80\x80\x00\x01\x40\x00\x64\x00\x00\x01\xd0\x70\x0b");

// table.wast:60
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x85\x80\x80\x80\x00\x01\x64\x70\x00\x01");

// table.wast:64
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x85\x80\x80\x80\x00\x01\x64\x70\x00\x00");

// table.wast:68
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x04\x85\x80\x80\x80\x00\x01\x64\x6f\x00\x00");

// table.wast:72
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x04\x85\x80\x80\x80\x00\x01\x64\x00\x00\x00");

// table.wast:80
let $16 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x03\x82\x80\x80\x80\x00\x01\x00\x06\x87\x80\x80\x80\x00\x01\x64\x00\x00\xd2\x00\x0b\x07\x85\x80\x80\x80\x00\x01\x01\x67\x03\x00\x0a\x88\x80\x80\x80\x00\x01\x82\x80\x80\x80\x00\x00\x0b");

// table.wast:85
register("M", $16)

// table.wast:87
let $17 = instance("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x88\x80\x80\x80\x00\x02\x60\x00\x00\x60\x00\x01\x70\x02\x89\x80\x80\x80\x00\x01\x01\x4d\x01\x67\x03\x64\x00\x00\x03\x87\x80\x80\x80\x00\x06\x00\x01\x01\x01\x01\x01\x04\xa6\x80\x80\x80\x00\x05\x70\x00\x0a\x40\x00\x70\x00\x0a\xd2\x00\x0b\x40\x00\x64\x00\x00\x0a\xd2\x00\x0b\x40\x00\x70\x00\x0a\x23\x00\x0b\x40\x00\x64\x00\x00\x0a\x23\x00\x0b\x07\xa4\x80\x80\x80\x00\x05\x04\x67\x65\x74\x31\x00\x01\x04\x67\x65\x74\x32\x00\x02\x04\x67\x65\x74\x33\x00\x03\x04\x67\x65\x74\x34\x00\x04\x04\x67\x65\x74\x35\x00\x05\x0a\xbf\x80\x80\x80\x00\x06\x82\x80\x80\x80\x00\x00\x0b\x86\x80\x80\x80\x00\x00\x41\x01\x25\x00\x0b\x86\x80\x80\x80\x00\x00\x41\x04\x25\x01\x0b\x86\x80\x80\x80\x00\x00\x41\x07\x25\x02\x0b\x86\x80\x80\x80\x00\x00\x41\x08\x25\x03\x0b\x86\x80\x80\x80\x00\x00\x41\x09\x25\x04\x0b");

// table.wast:106
assert_return(() => call($17, "get1", []), "ref.null");

// table.wast:107
assert_return(() => call($17, "get2", []), "ref.func");

// table.wast:108
assert_return(() => call($17, "get3", []), "ref.func");

// table.wast:109
assert_return(() => call($17, "get4", []), "ref.func");

// table.wast:110
assert_return(() => call($17, "get5", []), "ref.func");

// table.wast:113
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x04\x85\x80\x80\x80\x00\x01\x64\x00\x00\x0a");

// table.wast:121
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x04\x85\x80\x80\x80\x00\x01\x64\x00\x00\x00");

// table.wast:129
assert_invalid("\x00\x61\x73\x6d\x01\x00\x00\x00\x01\x84\x80\x80\x80\x00\x01\x60\x00\x00\x04\x86\x80\x80\x80\x00\x01\x64\x00\x01\x00\x00");

// table.wast:140
assert_malformed("\x3c\x6d\x61\x6c\x66\x6f\x72\x6d\x65\x64\x20\x71\x75\x6f\x74\x65\x3e");

// table.wast:147
assert_malformed("\x3c\x6d\x61\x6c\x66\x6f\x72\x6d\x65\x64\x20\x71\x75\x6f\x74\x65\x3e");

// table.wast:154
assert_malformed("\x3c\x6d\x61\x6c\x66\x6f\x72\x6d\x65\x64\x20\x71\x75\x6f\x74\x65\x3e");
