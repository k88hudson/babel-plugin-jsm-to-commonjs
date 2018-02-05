"use strict";

// node 4 .includes polyfill
require("./lib/polyfill");

const DEFAULT_OPTIONS = {
  // Only Cu.imports matching the following pattern will be rewritten as import statements.
  basePath: /^resource:\/\//,

  // Should the import path be rewritten to exclude the basePath?
  // e.g. if the basePath is "resource://}, "resource://foo.jsm" becomes "foo.jsm"
  replace: false
};

module.exports = function plugin(babel) {
  const t = babel.types;
  let exportItems;

  // module.exports = {foo, bar, baz};
  function createModuleExports(exportedIdentifiers) {
    const left = t.memberExpression(t.identifier("module"), t.identifier("exports"));
    const right = t.objectExpression(exportedIdentifiers.map(item => {
      return t.objectProperty(t.identifier(item), t.identifier(item), false, true);
      // return typeof item === "string" ? t.objectProperty(item, item) : t.objectProperty(item[0], item[1]);
    }));
    return t.expressionStatement(t.assignmentExpression("=", left, right));
  }

  function replaceExports(nodes) {
    nodes.forEach(path => {
      if (
        path.isExpressionStatement() &&
        path.get("expression").isAssignmentExpression() &&
        path.get("expression.left.object").isThisExpression() &&
        path.get("expression.left.property").isIdentifier()
      ) {
        const left = path.node.expression.left.property
        const right = path.node.expression.right;
        if (left.name === "EXPORTED_SYMBOLS") {
          // const names = right.elements.map(el => el.value);
          // path.replaceWith(createModuleExports(names));
          exportItems = right.elements.map(el => el.value);
          path.remove();
        } else {
          const decl = t.variableDeclaration("var", [t.variableDeclarator(left, right)]);
          if (left.name === right.name) {
            path.remove();
          } else {
            path.replaceWith(decl);
          }
        }
      }
    });
  }

  function checkForDeclarations(nodes, id, finalResults) {
    const results = [];
    if (!finalResults) finalResults = [];
    nodes.forEach(parentPath => {
      if (!parentPath.isVariableDeclaration()) return;
      parentPath.traverse({
        VariableDeclarator(path) {
          if (!path.get("id").isIdentifier()) return;
          const init = path.get("init");
          if (init.isIdentifier() && init.node.name === id) {
            results.push(path.node.id.name);
          }
        }
      });
    });
    if (results.length) {
      finalResults.push.apply(finalResults, results);
      results.forEach(name => {
        checkForDeclarations(nodes, name, finalResults);
      });
      return finalResults;
    } else {
      return finalResults;
    }
  }

  function checkForUtilsDeclarations(nodes, ids) {
    const results = [];
    nodes.forEach(parentPath => {
      if (!parentPath.isVariableDeclaration()) return;
      parentPath.traverse({
        VariableDeclarator(path) {
          const id = path.get("id");
          const init = path.get("init");

          // const {utils} = Components;
          if (
            id.isObjectPattern() &&
            init.isIdentifier() &&
            ids.includes(init.node.name)
          ) {
            id.node.properties.forEach(prop => {
              if (prop.key.name === "utils") {
                results.push(prop.value.name);
              }
            });
          }

          // const foo = Components.utils;
          else if (
            id.isIdentifier() &&
            init.isMemberExpression() &&
            init.get("object").isIdentifier() &&
            ids.includes(init.get("object").node.name) &&
            init.get("property").isIdentifier() &&
            init.get("property").node.name === "utils"
          ) {
            results.push(id.node.name);
          }
        }
      });
    });
    return results;
  }

  function replaceImports(nodes, ComponentNames, CuNames, basePath, replacePath) {
    nodes.forEach(p => {
      if (!p.isVariableDeclaration()) return;
      p.traverse({
        CallExpression(path) {
          if (
            t.isStringLiteral(path.node.arguments[0]) &&
            path.node.arguments[0].value.match(basePath) &&
            t.isObjectPattern(path.parentPath.node.id) &&

            // Check if actually Components.utils.import
            path.get("callee").isMemberExpression() &&
            path.get("callee.property").node.name === "import"
          ) {
            const callee = path.get("callee");
            if (callee.get("object").isMemberExpression()) {
              if (
                !ComponentNames.includes(callee.get("object.object").node.name) ||
                callee.get("object.property").node.name !== "utils"
              ) {
                return;
              }
            } else {
              const objectName = callee.get("object").node.name;
              if (objectName !== "ChromeUtils" && !CuNames.includes(objectName)) {
                return;
              }
            }
            let filePath = path.node.arguments[0].value;
            if (replacePath) filePath = filePath.replace(basePath, "");
            const requireStatement = t.callExpression(t.identifier("require"), [t.stringLiteral(filePath)]);
            path.replaceWith(requireStatement);
          }
        }
      });
    });

  }

  function replaceModuleGetters(paths, basePath, replacePath) {
    paths.forEach(path => {
      if (
        path.isExpressionStatement() &&
        path.get("expression").isCallExpression() &&
       ["XPCOMUtils", "ChromeUtils"].includes(path.get("expression.callee.object.name").node) &&
       ["defineLazyModuleGetter", "defineModuleGetter"].includes(path.get("expression.callee.property.name").node)
      ) {
        const argPaths = path.get("expression.arguments");
        const idName = argPaths[1].node.value;
        let filePath = argPaths[2].node.value;

        if (!filePath.match(basePath)) return;

        if (replacePath) filePath = filePath.replace(basePath, "");
        const requireStatement = t.callExpression(t.identifier("require"), [t.stringLiteral(filePath)]);
        const varDecl = t.variableDeclaration("var", [t.variableDeclarator(t.objectPattern([t.objectProperty(t.identifier(idName), t.identifier(idName), false, true  )]), requireStatement)]);
        path.replaceWith(varDecl);

      }
    });
  }

  return {
    visitor: {
      Program(path, state) {
        const opts = Object.assign({}, DEFAULT_OPTIONS, state.opts);
        const topLevelNodes = path.get("body");
        const ids = checkForDeclarations(topLevelNodes, "Components", ["Components"]);
        const utils = checkForUtilsDeclarations(topLevelNodes, ids);
        replaceImports(topLevelNodes, ids, utils, opts.basePath, opts.replace);
        replaceModuleGetters(topLevelNodes, opts.basePath, opts.replace);
        replaceExports(topLevelNodes);
        if (exportItems) {
          path.pushContainer('body', createModuleExports(exportItems));
        }
      }
    }
  }
};
