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
  //console.log(`${fileName}\n--------------------------\n${actual}\n--------------------------`);
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
    it("should convert ChomeUtils.import", () => {
      assert.equalIgnoreSpaces(
        transform("const {foo} = ChromeUtils.import('resource://foo.jsm', {})"),
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
    describe("XPCOMUtils.defineLazyModuleGetter", () => {
      it("should convert XPCOMUtils.defineLazyModuleGetter", () => {
        const actual = transform("XPCOMUtils.defineLazyModuleGetter(this, 'Foo', 'resource://as/Foo.jsm');");
        const expected = "var {Foo} = require('resource://as/Foo.jsm');";
        assert.equalIgnoreSpaces(actual, expected);
      });
      it("should replace the resource base if opts.replace is true", () => {
        const text = "XPCOMUtils.defineLazyModuleGetter(this, 'Foo', 'resource://as/Foo.jsm');";
        const actual = babel.transform(text, {plugins: [[plugin, {basePath: /^resource:\/\/as\//, replace: true}]]}).code;
        const expected = "var {Foo} = require('Foo.jsm');";
        assert.equalIgnoreSpaces(actual, expected);
      });
      it("should not replace XPCOM... that do not match the basePath", () => {
        const text = "XPCOMUtils.defineLazyModuleGetter(this, 'Foo', 'module://Foo.jsm');";
        const actual = babel.transform(text, {plugins: [[plugin, {basePath: /^resource:\/\/as\//}]]}).code;
        assert.equalIgnoreSpaces(actual, text);
      });
    });
    describe("ChromeUtils.defineModuleGetter", () => {
      it("should convert ChromeUtils.defineModuleGetter", () => {
        const actual = transform("ChromeUtils.defineModuleGetter(this, 'Foo', 'resource://as/Foo.jsm');");
        const expected = "var {Foo} = require('resource://as/Foo.jsm');";
        assert.equalIgnoreSpaces(actual, expected);
      });
    });
  });
  describe("exports", () => {
    it("should work", () => {
      testFile("export.js");
    });
    it("should convert this.EXPORTED_SYMBOLS", () => {
      assert.equalIgnoreSpaces(transform("this.EXPORTED_SYMBOLS = ['a', 'b'];"), "module.exports = {a, b};");
    });
    it("should convert var EXPORTED_SYMBOLS", () => {
      assert.equalIgnoreSpaces(transform("var EXPORTED_SYMBOLS = ['a', 'b'];"), "module.exports = {a, b};");
    });
    it("should convert exported variables of the same name", () => {
      assert.equalIgnoreSpaces(
        transform("const i = 0; this.i = i; var EXPORTED_SYMBOLS = ['i']"),
        "const i = 0; module.exports = {i};"
      );
    });
    it("should convert exported variables of a different name", () => {
      assert.equalIgnoreSpaces(
        transform("this.i = x; var EXPORTED_SYMBOLS = ['i']"),
        "var i = x; module.exports = {i};"
      );
    });
    it("should convert exported functions", () => {
      assert.equalIgnoreSpaces(
        transform("this.i = function i() {}; var EXPORTED_SYMBOLS = ['i']"),
        "var i = function i() {}; module.exports = {i};"
      );
    });
    it("should convert exported expressions", () => {
      assert.equalIgnoreSpaces(
        transform("this.i = 2 + 3; var EXPORTED_SYMBOLS = ['i']"),
        "var i = 2 + 3; module.exports = {i};"
      );
    });
    it("should move module.exports to the bottom", () => {
      assert.equalIgnoreSpaces(
        transform("var EXPORTED_SYMBOLS = ['i']; this.i = 1"),
        "var i = 1; module.exports = {i};"
      );
    });
  });
});
