const Com = Components;
const C = Com;
const { utils: Cu } = C;
const { utils } = Components;

const { foo, afw } = require("resource://stuff");
const { bar } = require("resource://stuff");
const { awe } = require("resource://stuff");
const { wiz } = require("resource://stuff");

const { baz } = Components.utils.flimport("resource://stuff", {});
const { qux } = Components.u.import("resource://stuff", {});

var {
  PreviewProvider
} = require("resource:///modules/PreviewProvider.jsm");

var {
  PreviewProvider
} = require("resource:///modules/PreviewProvider.jsm");
