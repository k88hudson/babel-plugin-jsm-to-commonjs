const chai = require("chai");
const assert = chai.assert;
const babel = require("babel-core");
const plugin = require("../plugin");
const path = require("path");
const fs = require("fs");

chai.use(require("chai-string"));

function testFile(fileName) {
  const sourceFile = path.join(__dirname, "./fixtures/source", fileName);
  const actual = babel.transformFileSync(sourceFile, {plugins: [plugin]}).code + "\n";
  const expected = fs.readFileSync(path.join(__dirname, "./fixtures/expected", fileName), {encoding: "utf8"});
  // console.log(`${fileName}\n--------------------------\n${actual}\n--------------------------`);
  assert.equal(actual, expected);
}

function transform(text) {
  return babel.transform(text, {plugins: [plugin]}).code;
}

describe("babel-plugin-jsm-to-common-js", () => {
  describe("imports", () => {
    it("should work", () => {
      testFile("import.js");
    });
    it("should convert Components.utils.import", () => {
      assert.equalIgnoreSpaces(
        transform("const {foo} = Components.utils.import('resource://foo.jsm', {})"),
        "const {foo} = require('resource://foo.jsm');"
      );
    });
    it("should work with references of Components", () => {
      assert.equalIgnoreSpaces(
        transform("const C = Components; const {foo} = C.utils.import('resource://foo.jsm', {});"),
        "const C = Components; const {foo}  = require('resource://foo.jsm');"
      );
    });
    it("should work with references of Components.utils", () => {
      assert.equalIgnoreSpaces(
        transform("const Cu = Components.utils; const {foo} = Cu.import('resource://foo.jsm', {});"),
        "const Cu = Components.utils; const {foo} = require('resource://foo.jsm');"
      );
    });
    it("should work with assignment destructuring", () => {
      assert.equalIgnoreSpaces(
        transform("const {utils} = Components; const {foo} = utils.import('resource://foo.jsm', {});"),
        "const {utils} = Components; const {foo} = require('resource://foo.jsm');"
      );
    });
    it("should work with assignment destructuring with renaming", () => {
      assert.equalIgnoreSpaces(
        transform("const {utils: Cu} = Components; const {foo} = Cu.import('resource://foo.jsm', {});"),
        "const {utils: Cu} = Components; const {foo} = require('resource://foo.jsm');"
      );
    });
    it("should work with a custom resource base", () => {
      const text = "const {foo} = Components.utils.import('resource://as/foo.jsm', {})";
      const actual = babel.transform(text, {plugins: [[plugin, {basePath: /^resource:\/\/as\//}]]}).code;
      const expected = "const {foo} = require('resource://as/foo.jsm');";
      assert.equalIgnoreSpaces(actual, expected);
    });
    it("should replace the resource base if opts.replace is true", () => {
      const text = "const {foo} = Components.utils.import('resource://as/foo.jsm', {})";
      const actual = babel.transform(text, {plugins: [[plugin, {basePath: /^resource:\/\/as\//, replace: true}]]}).code;
      const expected = "const {foo} = require('foo.jsm');";
      assert.equalIgnoreSpaces(actual, expected);
    });
    it("should work with a string for the basePath option", () => {
      const text = "const {foo} = Components.utils.import('resource://as/foo.jsm', {})";
      const actual = babel.transform(text, {plugins: [[plugin, {basePath: "resource://as/", replace: true}]]}).code;
      const expected = "const {foo} = require('foo.jsm');";
      assert.equalIgnoreSpaces(actual, expected);
    });
  });
  describe("exports", () => {
    it("should work", () => {
      testFile("export.js");
    });
    it("should convert EXPORTED_SYMBOLS", () => {
      assert.equalIgnoreSpaces(transform("this.EXPORTED_SYMBOLS = ['a', 'b'];"), "module.exports = {a, b};");
    });
    it("should convert exported variables of the same name", () => {
      assert.equalIgnoreSpaces(
        transform("const i = 0; this.i = i; this.EXPORTED_SYMBOLS = ['i']"),
        "const i = 0; module.exports = {i};"
      );
    });
    it("should convert exported variables of a different name", () => {
      assert.equalIgnoreSpaces(
        transform("this.i = x; this.EXPORTED_SYMBOLS = ['i']"),
        "var i = x; module.exports = {i};"
      );
    });
    it("should convert exported functions", () => {
      assert.equalIgnoreSpaces(
        transform("this.i = function i() {}; this.EXPORTED_SYMBOLS = ['i']"),
        "var i = function i() {}; module.exports = {i};"
      );
    });
    it("should convert exported expressions", () => {
      assert.equalIgnoreSpaces(
        transform("this.i = 2 + 3; this.EXPORTED_SYMBOLS = ['i']"),
        "var i = 2 + 3; module.exports = {i};"
      );
    });
    it("should move module.exports to the bottom", () => {
      assert.equalIgnoreSpaces(
        transform("this.EXPORTED_SYMBOLS = ['i']; this.i = 1"),
        "var i = 1; module.exports = {i};"
      );
    });
  });
});
