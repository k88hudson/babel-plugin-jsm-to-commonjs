const Com = Components;
const C = Com;
const { utils: Cu } = C;
const { utils } = Components;

const { foo, afw } = require("resource://stuff");
const { bar } = require("resource://stuff");
const { awe } = require("resource://stuff");

const { baz } = Components.utils.flimport("resource://stuff", {});
const { qux } = Components.u.import("resource://stuff", {});
