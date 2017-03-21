# JSM to ES Module Common JS

[![Build Status](https://travis-ci.org/k88hudson/babel-plugin-jsm-to-commonjs.svg?branch=master)](https://travis-ci.org/k88hudson/babel-plugin-jsm-to-commonjs)

This module converts import and export statements in `.jsm` modules to commonjs modules. For example:

Source:

```js
const {utils: Cu} = Components;
const {Bar, Baz} = Cu.import("resource://activity-stream/addon/barbaz.jsm", {});

this.Stuff = {};
this.Whatever = {};

this.EXPORTED_SYMBOLS = ["Stuff", "Whatever"];
```

Compiles to:

```js
const {Bar, Baz} = require("addon/barbaz.js");

var Stuff = {};
var Whatever = {};

module.exports = {Stuff, Whatever};
```

## Options

### `basePath`

Defaults to `/^resource:\/\/`. A RegEx or String that tests for which import paths to rewrite.

### `replace`

Defaults to `false`. Remove the `basePath` component of the import string?

e.g. If the basePath is `/^resource:\/\/`, `resource://activity-stream/foo.js` will be rewritten to `activity-stream/foo.js`.

```
"plugins": ["transform-react-jsx", {basePath: "resource://activity-stream/"}],
```
